import {
  ActionPanel,
  Action,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState, useMemo } from "react";
import * as os from "os";
import { execSync } from "child_process";

interface IpApiData {
  status: "success" | "fail";
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  query?: string;
}

interface IpWhoIsData {
  ip?: string;
  success?: boolean;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  flag?: {
    emoji?: string;
    emoji_unicode?: string;
  };
  connection?: {
    asn?: number;
    org?: string;
    isp?: string;
  };
  timezone?: {
    id?: string;
  };
}

interface IpResult {
  publicIpv4?: string;
  publicIpv6?: string;
  localIpv4?: string;
  localIpv6?: string;
  country?: string;
  countryCode?: string;
  flagEmoji?: string;
  location?: string;
  coordinates?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  as?: string;
  isp?: string;
  organization?: string;
  rawJson?: Record<string, unknown>;
}

interface IpInfoRow {
  key: string;
  label: string;
  copyLabel: string;
  value: string;
  rawCopyValue?: string;
  icon: string | Icon;
  accessoryIcon?: string | Icon;
  url?: string;
}

// Convert 2-letter ISO country code to Unicode Flag emoji
function getCountryFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 4000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "curl/8.4.0",
      },
    });
  } finally {
    clearTimeout(id);
  }
}

function getLocalIpAddresses(): { ipv4?: string; ipv6?: string } {
  let ipv4: string | undefined;
  let ipv6: string | undefined;

  // 1. Try Node.js os.networkInterfaces() with robust family checks
  try {
    const interfaces = os.networkInterfaces();
    const sortedKeys = Object.keys(interfaces).sort((a, b) => {
      if (a === "en0") return -1;
      if (b === "en0") return 1;
      return a.localeCompare(b);
    });

    for (const name of sortedKeys) {
      const list = interfaces[name] || [];
      for (const iface of list) {
        if (iface.internal) continue;
        const fam = String(iface.family).toLowerCase();
        const isIpv4 = fam === "ipv4" || fam === "4";
        const isIpv6 = fam === "ipv6" || fam === "6";

        if (!ipv4 && isIpv4) {
          ipv4 = iface.address;
        }
        if (!ipv6 && isIpv6) {
          ipv6 = iface.address;
        }
      }
    }
  } catch {
    // ignore os errors
  }

  // 2. Fallback for Local IPv4 on macOS via ipconfig
  if (!ipv4) {
    for (const iface of ["en0", "en1", "en2", "en3", "en4"]) {
      try {
        const out = execSync(`ipconfig getifaddr ${iface}`, {
          encoding: "utf8",
          timeout: 1000,
        }).trim();
        if (out && !out.includes("not found")) {
          ipv4 = out;
          break;
        }
      } catch {
        // try next interface
      }
    }
  }

  // 3. Fallback for Local IPv6 on macOS
  if (!ipv6) {
    for (const iface of ["awdl0", "en0", "en1", "llw0"]) {
      try {
        const out = execSync(`ifconfig ${iface} 2>/dev/null | grep inet6`, {
          encoding: "utf8",
          timeout: 1000,
        });
        const match = out.match(/inet6\s+([a-f0-9:]+)/i);
        if (match && match[1] && !match[1].startsWith("::1")) {
          ipv6 = match[1];
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  return { ipv4, ipv6 };
}

async function fetchAllIpInfo(): Promise<IpResult> {
  // 1. Local IPs (instant, offline & free)
  const local = getLocalIpAddresses();

  // 2. Query Public IPv4 and Public IPv6 in parallel
  const [resIpv4, resIpv6] = await Promise.allSettled([
    fetchWithTimeout("https://api4.ipify.org?format=json", 4000).then(
      (r) => r.json() as Promise<{ ip: string }>,
    ),
    fetchWithTimeout("https://api6.ipify.org?format=json", 2500).then(
      (r) => r.json() as Promise<{ ip: string }>,
    ),
  ]);

  let publicIpv4 =
    resIpv4.status === "fulfilled" && resIpv4.value?.ip
      ? resIpv4.value.ip
      : undefined;
  const publicIpv6 =
    resIpv6.status === "fulfilled" && resIpv6.value?.ip
      ? resIpv6.value.ip
      : undefined;

  // 3. Query GeoLocation & Network Info
  let geoData: IpApiData | null = null;
  let flagEmoji = "";
  let countryCode = "";
  let countryName = "";

  let rawJson: Record<string, unknown> = {
    localIpv4: local.ipv4,
    localIpv6: local.ipv6,
    publicIpv4,
    publicIpv6,
  };

  try {
    const geoUrl = publicIpv4
      ? `http://ip-api.com/json/${publicIpv4}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query&lang=de`
      : "http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query&lang=de";

    const resGeo = await fetchWithTimeout(geoUrl, 5000);
    if (resGeo.ok) {
      const data = (await resGeo.json()) as IpApiData;
      if (data.status === "success") {
        geoData = data;
        countryCode = data.countryCode || "";
        countryName = data.country || "";
        flagEmoji = getCountryFlag(countryCode);
        if (!publicIpv4 && data.query && !data.query.includes(":")) {
          publicIpv4 = data.query;
        }
        rawJson = { ...rawJson, ...data };
      }
    }
  } catch {
    // If ip-api fails, try fallback ipwho.is
    try {
      const fallbackUrl = publicIpv4
        ? `https://ipwho.is/${publicIpv4}`
        : "https://ipwho.is/";
      const resFallback = await fetchWithTimeout(fallbackUrl, 5000);
      if (resFallback.ok) {
        const whoData = (await resFallback.json()) as IpWhoIsData;
        if (whoData.success !== false) {
          countryCode = whoData.country_code || "";
          countryName = whoData.country || "";
          flagEmoji = whoData.flag?.emoji || getCountryFlag(countryCode);
          geoData = {
            status: "success",
            country: countryName,
            countryCode,
            regionName: whoData.region,
            city: whoData.city,
            zip: whoData.postal,
            lat: whoData.latitude,
            lon: whoData.longitude,
            timezone: whoData.timezone?.id,
            isp: whoData.connection?.isp,
            org: whoData.connection?.org,
            as: whoData.connection?.asn
              ? `AS${whoData.connection.asn}`
              : undefined,
          };
          rawJson = { ...rawJson, ...whoData };
        }
      }
    } catch {
      // Both providers failed
    }
  }

  // Format Location string: e.g. "Deutschland, Nordrhein-Westfalen, Emsdetten, ZIP: 48282"
  let location: string | undefined;
  if (geoData) {
    const parts: string[] = [];
    if (geoData.country) parts.push(geoData.country);
    if (geoData.regionName) parts.push(geoData.regionName);
    if (geoData.city) parts.push(geoData.city);
    if (geoData.zip) parts.push(`ZIP: ${geoData.zip}`);
    if (parts.length > 0) {
      location = parts.join(", ");
    }
  }

  // Format GeoCoordinates: e.g. "52.1734 , 7.52781"
  let coordinates: string | undefined;
  if (geoData?.lat !== undefined && geoData?.lon !== undefined) {
    coordinates = `${geoData.lat} , ${geoData.lon}`;
  }

  // Format AS: e.g. "AS9009"
  let asNumber: string | undefined;
  if (geoData?.as) {
    asNumber = geoData.as.split(" ")[0];
  }

  return {
    publicIpv4,
    publicIpv6,
    localIpv4: local.ipv4,
    localIpv6: local.ipv6,
    country: countryName,
    countryCode,
    flagEmoji,
    location,
    coordinates,
    lat: geoData?.lat,
    lon: geoData?.lon,
    timezone: geoData?.timezone,
    as: asNumber,
    isp: geoData?.isp,
    organization: geoData?.org,
    rawJson,
  };
}

export default function Command() {
  const [data, setData] = useState<IpResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAllIpInfo();
      setData(result);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch IP info";
      setError(errorMessage);
      showToast({
        style: Toast.Style.Failure,
        title: "Error fetching IP info",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Requested order: ipv4, ipv6, local ip4, local ip6, location, geocoordinates, timezone, as, isp, organization
  const items = useMemo<IpInfoRow[]>(() => {
    if (!data) return [];

    const rows: IpInfoRow[] = [];
    const flag = data.flagEmoji || "";

    // 1. Public IPv4
    if (data.publicIpv4) {
      rows.push({
        key: "publicIpv4",
        label: "Public IPv4",
        copyLabel: "Public IPv4",
        value: data.publicIpv4,
        icon: Icon.Globe,
        accessoryIcon: flag || undefined,
      });
    }

    // 2. Public IPv6
    if (data.publicIpv6) {
      rows.push({
        key: "publicIpv6",
        label: "Public IPv6",
        copyLabel: "Public IPv6",
        value: data.publicIpv6,
        icon: Icon.Globe,
      });
    }

    // 3. Local IPv4
    if (data.localIpv4) {
      rows.push({
        key: "localIpv4",
        label: "Local IPv4",
        copyLabel: "Local IPv4",
        value: data.localIpv4,
        icon: Icon.Info,
      });
    }

    // 4. Local IPv6
    if (data.localIpv6) {
      rows.push({
        key: "localIpv6",
        label: "Local IPv6",
        copyLabel: "Local IPv6",
        value: data.localIpv6,
        icon: Icon.BullsEye,
      });
    }

    // 5. Location (with flag emoji)
    if (data.location) {
      const locationDisplay = flag ? `${flag} ${data.location}` : data.location;
      rows.push({
        key: "location",
        label: "Location",
        copyLabel: "Location",
        value: locationDisplay,
        rawCopyValue: data.location,
        icon: flag || Icon.Map,
      });
    }

    // 6. GeoCoordinates
    if (data.coordinates) {
      const mapsUrl =
        data.lat !== undefined && data.lon !== undefined
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${data.lat},${data.lon}`)}`
          : undefined;

      rows.push({
        key: "coordinates",
        label: "GeoCoordinates",
        copyLabel: "GeoCoordinates",
        value: data.coordinates,
        icon: Icon.Geopin,
        url: mapsUrl,
      });
    }

    // 7. Timezone
    if (data.timezone) {
      rows.push({
        key: "timezone",
        label: "Timezone",
        copyLabel: "Timezone",
        value: data.timezone,
        icon: Icon.Clock,
      });
    }

    // 8. AS
    if (data.as) {
      rows.push({
        key: "as",
        label: "AS",
        copyLabel: "AS",
        value: data.as,
        icon: Icon.Crop,
      });
    }

    // 9. ISP
    if (data.isp) {
      rows.push({
        key: "isp",
        label: "ISP",
        copyLabel: "ISP",
        value: data.isp,
        icon: Icon.Livestream,
      });
    }

    // 10. Organization
    if (data.organization) {
      rows.push({
        key: "organization",
        label: "Organization",
        copyLabel: "Organization",
        value: data.organization,
        icon: Icon.Building,
      });
    }

    return rows;
  }, [data]);

  const allInfoString = useMemo(() => {
    if (!items.length) return "";
    return items
      .map((item) => `${item.copyLabel}: ${item.rawCopyValue || item.value}`)
      .join("\n");
  }, [items]);

  const allInfoJson = useMemo(() => {
    if (!data?.rawJson) return "";
    return JSON.stringify(data.rawJson, null, 2);
  }, [data]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter IP details...">
      {items.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Warning}
          title={
            error
              ? "Failed to load IP information"
              : "No IP information available"
          }
          description={error || "Check your internet connection and try again."}
          actions={
            <ActionPanel>
              <Action
                title="Retry"
                icon={Icon.RotateClockwise}
                onAction={loadData}
              />
            </ActionPanel>
          }
        />
      ) : (
        items.map((item) => (
          <List.Item
            key={item.key}
            icon={item.icon}
            title={item.label}
            accessories={
              item.accessoryIcon
                ? [{ text: item.value, icon: item.accessoryIcon }]
                : [{ text: item.value }]
            }
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.CopyToClipboard
                    title={`Copy ${item.copyLabel}`}
                    content={item.rawCopyValue || item.value}
                    icon={
                      typeof item.icon === "string" && !item.icon.includes("-")
                        ? Icon.Clipboard
                        : item.icon
                    }
                  />
                  <Action.CopyToClipboard
                    title="Copy All Info"
                    content={allInfoString}
                    icon={Icon.Clipboard}
                    shortcut={{ modifiers: ["cmd"], key: "return" }}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action.CopyToClipboard
                    title="Copy All as JSON"
                    content={allInfoJson}
                    icon={Icon.Code}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  />
                  {item.url && (
                    <Action.OpenInBrowser
                      title="Open in Google Maps"
                      url={item.url}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
                    />
                  )}
                  <Action
                    title="Reload"
                    icon={Icon.RotateClockwise}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={loadData}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
