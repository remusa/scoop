import { execSync } from "child_process";
import { readdirSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { tmpdir } from "os";

type Category =
  | "Games"
  | "Gaming"
  | "Productivity"
  | "Development"
  | "Media"
  | "Browsers"
  | "Communication"
  | "Utilities"
  | "Other";

interface Program {
  displayName: string;
  displayVersion: string;
  publisher: string;
  installDate: string;
  source: "registry" | "scoop" | "winget" | "openshell";
  category: Category;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(x64\)|\s*\(x86\)|\s*\(arm64\)/gi, "")
    .replace(/\s*edition/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// --- Filtering ---

// Patterns to match non-user-installed programs (by display name)
const BLOCKLIST_PATTERNS: RegExp[] = [
  // Template/invalid names
  /^\$\{\{/, // ${{arpDisplayName}}
  // NVIDIA CUDA/dev tools
  /\bcuda\b/i,
  /\bcublas\b/i,
  /\bcudnn\b/i,
  /\bcuobjdump\b/i,
  /\bcupti\b/i,
  /\bcurand\b/i,
  /\bcusolver\b/i,
  /\bcusparse\b/i,
  /\bcufft\b/i,
  /\bcuxxfilt\b/i,
  /\bnvcc\b/i,
  /\bnvcpl\b/i,
  /\bnvfatbin\b/i,
  /\bnvjitlink\b/i,
  /\bnvjpeg\b/i,
  /\bnvml\b/i,
  /\bnvprune\b/i,
  /\bnvrtc\b/i,
  /\bnvtx\b/i,
  /\bnpp\b/i,
  /\bcompute\s*sanitizer\b/i,
  /\bdisassembler\b/i,
  /\bvisual\s*profiler\b/i,
  /\boccupancy\s*calculator\b/i,
  /\bdemo\s*suite\b/i,
  /\bprofile\s*api\b/i,
  /\bprofiler\s*tools\b/i,
  // NVIDIA infrastructure/services
  /\bnvidia\s*(container|backend|telemetry|session|local|user|watchdog|messagebus|aiuser|nvdlisr)/i,
  /\bnvidia\s*(nsight|physx|install|app)\b/i,
  /\bnvidia\s*(rtx\s*remix|frameview|shadowplay|virtual\s*audio|hd\s*audio|graphics\s*driver)/i,
  /\bnvidia\s*(broadcast|dlss)/i,
  // .NET components
  /microsoft\s*\.?\s*net\b/i,
  /\basp\.?\s*net\b/i,
  /\bnet\s*(host|runtime|targeting|toolset|standard)\b/i,
  /\bapphost\s*pack\b/i,
  /\bworkload\./i,
  /microsoft\.net\./i,
  // Visual C++ runtimes
  /microsoft\s*visual\s*c\+\+\s*\d{4}/i,
  /\bvc\+\+\s*\d{4}/i,
  /\bvcpp_crt\b/i,
  /vcredist\d{4}/i,
  // SQL Server components (keep Management Studio — it's a user app)
  /sql\s*server\s*\d{4}/i,
  /ssms\b/i,
  /sql\s*server\s*management/i,
  /\bodbc\s*driver\b/i,
  /\bole\s*db\s*driver\b/i,
  /\bproveedor\s*ole\b/i,
  // Windows SDK / CRT / infrastructure
  /\buniversal\s*crt\b/i,
  /\bwindows\s*sdk\b/i,
  /\bwindows\s*software\s*development\s*kit\b/i,
  /\bwindows\s*desktop\s*(extension|targeting|runtime)\b/i,
  /windows\s*(iot|mobile|team|store)\s*(extension|sdk)/i,
  /\bwinrt\b/i,
  /\bvs_\w+/i,
  /\bvs\s*script\s*debugging\b/i,
  /\bvs\s*filehandler\b/i,
  /\bvs_FileTracker\b/i,
  /\bvs_githubprotocolhandler\b/i,
  /\bvs_minshellinterop\b/i,
  /\bvs_coreeditorfonts\b/i,
  /\bvisual\s*studio\s*(build|isolated|shell)\b/i,
  // Windows updates
  /\bupdate\s*for\s*x64.*KB\d+\b/i,
  /\bKB\d{7}\b/i,
  /\bapplication\s*verifier\b/i,
  // Windows drivers
  /windows\s*driver\s*package/i,
  // Windows components
  /\bupdate\s*health\s*tools\b/i,
  /\bgameinput\b/i,
  /\bapp\s*installer\b/i,
  /\bwindows\s*subsystem\s*for\s*(linux|android)/i,
  /\bwindows\s*terminal\s*preview\b/i,
  /windowsappruntime/i,
  /microsoft\.ui\.xaml/i,
  /microsoft\.xna\b/i,
  // Android system packages
  /\bgoogle\s*(play\s*services|partner\s*setup|cloud\s*sdk)\b/i,
  /\bandroid\s*(auto|switch)\b/i,
  /\bmagisk\b/i,
  // Redistributables
  /\bredistributable\b/i,
  // SDK manifests
  /microsoft\.net\.sdk\./i,
  // Intel infrastructure
  /\bdocumentation\s*manager\b/i,
  /\bintel.*software\s*installer\b/i,
  // Other infrastructure
  /\bsetup\s*(english|tasks)\b/i,
  /\bmsi\s*development\b/i,
  /\bwinappdeploy\b/i,
  /\bpromontory\b/i,
  // Visual Studio Installer
  /\bvisual\s*studio\s*installer\b/i,
  /\bvisual\s*studio\s*setup\b/i,
  /\bvisual\s*studio\s*tools\s*for\s*applications\b/i,
  /\bvisual\s*studio\s*2010\s*tools\b/i,
  // Python sub-components
  /python\s*[\d.]+\s*(add to path|core interpreter|development|documentation|executables|pip bootstrap|standard library|tcl|test suite)/i,
  // PowerToys duplicates
  /\(preview\)\s*x64\b/i,
  // DirectX system component
  /\bdirectx\b/i,
  /\bplay\s*store\b/i,
  /\bprerequisites?\s*\(x64\)/i,
];

// Known infrastructure publishers — entries from these get filtered unless they pass a name check
const INFRASTRUCTURE_PUBLISHERS = [
  "microsoft corporation",
  "nvidia corporation",
  "intel corporation",
  "intel(r) corporation",
  "advanced micro devices, inc.",
  "android.google.com",
  "android.com",
];

function isBlockedByPattern(name: string): boolean {
  return BLOCKLIST_PATTERNS.some((re) => re.test(name));
}

function isInfrastructurePublisher(publisher: string): boolean {
  return INFRASTRUCTURE_PUBLISHERS.some((p) =>
    publisher.toLowerCase().includes(p)
  );
}

function shouldFilterOut(p: Program): boolean {
  const name = p.displayName.trim();
  if (!name) return true;

  // If name matches a blocklist pattern, filter out
  if (isBlockedByPattern(name)) return true;

  // If publisher is infrastructure AND name looks like a component (not a user app), filter out
  if (p.source === "registry" && p.publisher && isInfrastructurePublisher(p.publisher)) {
    // Heuristic: if the name contains version-like patterns or technical terms, filter
    if (/\b(x64|x86|arm64)\b/i.test(name)) return true;
    if (/\b(runtime|redistributable|sdk|driver|component|update|hotfix|patch)\b/i.test(name)) return true;
    if (/\b\d{4}\b/.test(name) && /\b(v\d+|version|release)\b/i.test(name)) return true;
  }

  return false;
}

// --- Categorization ---

// Small manual overrides keyed by normalized name
const CATEGORY_OVERRIDES: Record<string, Category> = {
  // Gaming
  "steam": "Gaming", "epic games launcher": "Gaming", "gog galaxy": "Gaming",
  "playnite": "Gaming", "heroic games launcher": "Gaming",
  "ubisoft connect": "Gaming", "ubisoftconnect": "Gaming",
  "uplay": "Gaming", "battle.net": "Gaming",
  "rockstar games launcher": "Gaming", "ea app": "Gaming",
  "steam achievement manager": "Gaming", "steam library manager": "Gaming",
  "steam rom manager": "Gaming", "steam desktop authenticator": "Gaming",
  "steam link": "Gaming", "moondeckbuddy": "Gaming", "emudeck": "Gaming",
  "ds4windows": "Gaming", "joyxoff": "Gaming", "rewasd": "Gaming",
  "special k": "Gaming", "dlss swapper": "Gaming",
  "nvidia profile inspector": "Gaming", "nvidia-profile-inspector": "Gaming",
  "msi afterburner": "Gaming", "msiafterburner": "Gaming",
  "msi kombustor": "Gaming", "msikombustor": "Gaming",
  "furmark": "Gaming", "gpu-z": "Gaming", "cpu-z": "Gaming",
  "cheat engine": "Gaming", "cheat-engine": "Gaming",
  "ludusavi": "Gaming", "wowup-cf": "Gaming", "wowup": "Gaming",
  "weakauras companion": "Gaming", "fluffy mod manager": "Gaming",
  "vigem bus driver": "Gaming", "3dmark": "Gaming",
  "achievement watcher": "Gaming", "amazon games": "Gaming",
  "amazongames-userinstall": "Gaming",
  "redlauncher": "Gaming", "goggalaxy": "Gaming",
  "deus ex": "Games", "deus ex: human revolution": "Games",
  "rtss": "Gaming", "vibrance-gui": "Gaming", "vibrance gui": "Gaming",
  "tinynvidiaupdatechecker": "Gaming", "tiny nvidia update checker": "Gaming",
  "ps3-system-software": "Gaming", "ps3 system software": "Gaming",
  // Media
  "obs studio": "Media", "obs-studio": "Media", "handbrake": "Media",
  "vlc": "Media", "mpv": "Media", "musicbee": "Media", "audacity": "Media",
  "reaper": "Media", "davinci resolve": "Media", "sharex": "Media",
  "paint.net": "Media", "nomacs": "Media", "neeview": "Media",
  "calibre": "Media", "okular": "Media", "sumatrapdf": "Media",
  "pdfgear": "Media", "stremio": "Media", "freetube": "Media",
  "tartube": "Media", "tauon": "Media", "mp3tag": "Media",
  "picard": "Media", "losslesscut": "Media", "yt-dlp": "Media",
  "ytdlp-interface": "Media", "gallery-dl": "Media",
  "streamlink twitch gui": "Media", "rode connect": "Media",
  "rode central": "Media", "equalizer apo": "Media", "fxsound": "Media",
  "potplayer": "Media", "comicrack community edition": "Media",
  "opencomic": "Media", "blackmagic raw": "Media",
  "blackmagic resolve": "Media", "davinci resolve control panels": "Media",
  "id ": "Media", "rode application fonts": "Media",
  "caesium-image-compressor": "Media", "caesium image compressor": "Media",
  "exifcleaner": "Media", "exif cleaner": "Media",
  // Browsers
  "firefox": "Browsers", "firefox dev": "Browsers", "floorp": "Browsers",
  "ablaze floorp": "Browsers", "librewolf": "Browsers", "brave": "Browsers",
  "vivaldi": "Browsers", "arc": "Browsers", "microsoft edge": "Browsers",
  "zen browser": "Browsers", "mullvad browser": "Browsers",
  "chromium": "Browsers", "google": "Browsers",
  // Communication
  "signal": "Communication", "whatsapp": "Communication",
  "discord": "Communication", "slack": "Communication",
  "teams": "Communication", "outlook": "Communication",
  "thunderbird": "Communication", "betterbird": "Communication",
  "mailspring": "Communication", "bitwarden": "Communication",
  "ferdium": "Communication", "fluent reader": "Communication",
  "raven reader": "Communication", "rss guard": "Communication",
  "x": "Communication", "twitter": "Communication",
  // Productivity
  "obsidian": "Productivity", "joplin": "Productivity",
  "onlyoffice desktop editors": "Productivity", "onlyoffice-desktopeditors": "Productivity",
  "sigil": "Productivity", "everything": "Productivity",
  "flow launcher": "Productivity", "fluent-search": "Productivity",
  "fluent search": "Productivity",
  "powertoys (preview)": "Productivity", "powertoys-np": "Productivity",
  "futo notes": "Productivity", "neovim": "Productivity",
  "vscode": "Productivity", "vscode-insiders": "Productivity",
  "vscodium": "Productivity", "resophnotes": "Productivity",
  "pomello": "Productivity", "super productivity": "Productivity",
  "taiga": "Productivity", "koodo reader": "Productivity",
  "masscode": "Productivity", "lm studio": "Productivity",
  "lmstudio": "Productivity", "msty": "Productivity",
  "open webui": "Productivity", "anki": "Productivity",
  "taskbarx": "Productivity", "taskbar x": "Productivity",
  "stretchly": "Productivity",
  "activitywatch": "Productivity", "activity watch": "Productivity",
  "deskflow": "Productivity", "quiterss": "Productivity",
  "rss guard": "Productivity",
  // Development
  "docker desktop": "Development", "docker": "Development",
  "git": "Development", "gh": "Development",
  "android-studio": "Development", "heidisql": "Development",
  "dbeaver": "Development", "http toolkit": "Development",
  "devtoys": "Development", "lazygit": "Development",
  "lazydocker": "Development", "wsl2-distro-manager": "Development",
  "podman desktop": "Development", "mise": "Development",
  "opencode": "Development", "wezterm": "Development",
  "ghostty": "Development", "adb": "Development",
  "android-clt": "Development", "rustup": "Development",
  "python 3.12.3 (64-bit)": "Development",
  "postgresql 16": "Development", "dotnet-sdk": "Development",
  "visual studio build tools 2022": "Development",
  "powershell 7.6.4.0-x64": "Development",
  "intel presentmon": "Development", "starship": "Development",
  "starship prompt": "Development", "pipx": "Development",
  "hydra": "Development", "dark": "Development",
  "scrcpy": "Development", "scrcpy-gui": "Development",
  // Utilities
  "7zip": "Utilities", "7-zip": "Utilities", "7zip19.00-helper": "Utilities",
  "nircmd": "Utilities", "rufus": "Utilities", "etcher": "Utilities",
  "ventoy": "Utilities", "wiztree": "Utilities", "bleachbit": "Utilities",
  "bulk crap uninstaller": "Utilities", "dupeguru": "Utilities",
  "file pilot": "Utilities", "link shell extension": "Utilities",
  "krokiet": "Utilities", "windhawk": "Utilities",
  "translucenttb": "Utilities", "twinkle tray": "Utilities",
  "twinkle-tray": "Utilities", "autohotkey1.1": "Utilities",
  "kanata-cmd": "Utilities", "whkd": "Utilities", "keyviz": "Utilities",
  "colorcontrol": "Utilities", "openrgb": "Utilities",
  "logitech g hub": "Utilities", "razer synapse": "Utilities",
  "steelseries gg": "Utilities", "nextdns": "Utilities",
  "portmaster": "Utilities", "simplewall": "Utilities",
  "windscribe": "Utilities", "netbird": "Utilities", "rustdesk": "Utilities",
  "localsend": "Utilities", "synctrayzor": "Utilities",
  "freefilesync": "Utilities", "duplicati": "Utilities",
  "rclone": "Utilities", "syncback": "Utilities",
  "driverstore explorer": "Utilities", "driverstoreexplorer": "Utilities",
  "ddu": "Utilities", "sophiapp": "Utilities", "open-shell": "Utilities",
  "bluescreenview": "Utilities", "whocrashed": "Utilities",
  "process lasso": "Utilities",
  "universal x86 tuning utility": "Utilities",
  "quick cpu": "Utilities", "reduce-memory": "Utilities",
  "privatilla": "Utilities", "privatezilla": "Utilities",
  "k-lite codec pack basic": "Utilities",
  "h2testw": "Utilities", "flash drive tester": "Utilities",
  "reaplugs/x64": "Utilities",
  "pawnio": "Utilities", "spacedisk": "Utilities",
  "wago app": "Utilities", "vial": "Utilities",
  "nuPhyIO": "Utilities", "nuphyio": "Utilities",
  "easeus data recovery wizard": "Utilities",
  "lossless scaling": "Utilities", "libredirect": "Utilities",
  "hurl": "Utilities",   "amd ryzen master": "Utilities",
  "ryzenmaster": "Utilities", "ryzenmastersdk": "Utilities",
  "bonjour": "Utilities", "msedgeredirect": "Utilities",
  "mse边缘重定向": "Utilities", "wallpaper engine": "Utilities",
  "crystaldiskinfo": "Utilities", "crystaldiskmark": "Utilities",
  "hwinfo": "Utilities", "hwmonitor": "Utilities",
  "harddisksentinel": "Utilities", "hard disk sentinel": "Utilities",
  "openhardwaremonitor": "Utilities", "open hardware monitor": "Utilities",
  "sidebar-diagnostics": "Utilities", "sidebar diagnostics": "Utilities",
  "monitorprofileswitcher": "Utilities", "monitor profile switcher": "Utilities",
  "multimonitortool": "Utilities", "multi monitor tool": "Utilities",
  "fancontrol": "Utilities", "fan control": "Utilities",
  "gsudo": "Utilities", "sudo": "Utilities",
  "dropit": "Utilities", "drop it": "Utilities",
  "espanso": "Utilities", "lightbulb": "Utilities",
  "modernflyouts": "Utilities", "modern flyouts": "Utilities",
  "eartrumpet": "Utilities", "ear trumpet": "Utilities",
  "trafficmonitor": "Utilities", "traffic monitor": "Utilities",
  "ntfy": "Utilities", "peace-np": "Utilities",
  "windowsspyblocker": "Utilities", "windows spy blocker": "Utilities",
  "magpie": "Utilities", "magpie scaler": "Utilities",
  "adwcleaner": "Utilities", "malwarebytes": "Utilities",
  "minitool partition wizard": "Utilities",
  "samsung usb driver": "Utilities",
  "innounp": "Utilities", "innounp helper": "Utilities",
  "nssm": "Utilities", "vcxsrv": "Utilities",
  "winfsp": "Utilities", "winfsp-np": "Utilities",
  "virtualbox": "Utilities", "virtualbox-with-extension-pack-np": "Utilities",
  "yubikey manager": "Utilities", "openal": "Utilities",
  "jdownloader": "Utilities", "abdownloadmanager": "Utilities",
  "ab download manager": "Utilities", "xdman": "Utilities",
  // Fonts (Utilities)
  "firacode": "Utilities", "firacode-nf-mono": "Utilities",
  "jetbrains-mono": "Utilities", "jetbrainsmono-nf-mono": "Utilities",
  "monaspace": "Utilities", "monaspace-nf": "Utilities",
  "monaspace-nf-mono": "Utilities", "monaspace-nf-proppo": "Utilities",
  "hack-nf": "Utilities", "hack-nf-mono": "Utilities",
  "geistmono-nf": "Utilities", "geistmono-nf-mono": "Utilities",
  "geistmono-nf-proppo": "Utilities",
  // Java (Development)
  "openjdk8-redhat-jre": "Development", "oraclejre8": "Development",
  "temurin-jre": "Development",
  // Runtimes (Development)
  "vcredist": "Development", "windowsdesktop-runtime": "Development",
  "windowsdesktop-runtime-lts": "Development",
  // Linux distros (Development)
  "debian": "Development", "ubuntu": "Development",
  // Benchmarks (Gaming)
  "heaven benchmark": "Gaming", "futuremark systeminfo": "Gaming",
};

// Publisher patterns that indicate game studios
const GAME_PUBLISHERS = [
  "valve", "capcom", "ubisoft", "electronic arts", "rockstar",
  "bethesda", "square enix", "cd projekt", "2k", "activision",
  "blizzard", "bandai namco", "sega", "konami", "koei tecmo",
  "obsidian", "inexile", "larian", "hello games", "ghost ship",
  "id software", "arkane", "remedy", "monic interactive",
  "vicarious visions", "riterion", "dice", "343 industries",
  "avalanche", "techland", "warhorse", "mojang", "nioh",
  "frictional games", "freebird games", "teyon", "double fine",
  "butterfly effect", "irlainteractive",
];

// Keyword patterns for categories
const CATEGORY_PATTERNS: [RegExp, Category][] = [
  [/\b(game|launch(er|pad)|play(nite|er)|mod\s*manager)\b/i, "Gaming"],
  [/\b(browser|firefox|chrome|edge|opera|vivaldi|brave|arc|tor)\b/i, "Browsers"],
  [/\b(chat|messenger|email|mail|discord|slack|teams|signal|whatsapp|telegram|skype|zoom|bitwarden|1password)\b/i, "Communication"],
  [/\b(player|media|video|audio|music|stream|record|edit|render|codec|podcast|radio|dj|synth|amp|mixer|equalizer|reaper|handbrake|ffmpeg|yt-dlp|gallery-dl|mpv|vlc|obs)\b/i, "Media"],
  [/\b(editor|notes|pdf|reader|ebook|calibre|okular|sumatra|docs|office|word|excel|powerpoint|obsidian|joplin|notion|logseq|zotero|mendeley)\b/i, "Productivity"],
  [/\b(dev|code|git|docker|node|python|ruby|rust|golang|java|sdk|ide|terminal|shell|neovim|vim|emacs|vscode|linter|debug|compiler|database|sql|postgres|mysql|redis|mongo|api|rest|graphql)\b/i, "Development"],
  [/\b(vpn|firewall|antivirus|cleaner|uninstaller|backup|sync|remote|screenshot|clipboard|hotkey|mouse|keyboard|monitor|tuner|overclock|fan|rgb|led)\b/i, "Utilities"],
  [/\b(font|mono|nerd|fira|hack|geist|monaspace|jetbrains)\b/i, "Utilities"],
];

function categorize(p: Program): Category {
  const norm = normalize(p.displayName);

  // 1. Manual overrides — try exact match, then check if normalized name starts with any override key
  if (CATEGORY_OVERRIDES[norm]) return CATEGORY_OVERRIDES[norm];
  for (const [key, cat] of Object.entries(CATEGORY_OVERRIDES)) {
    if (norm.startsWith(key + " ") || norm.startsWith(key + "-") || norm === key) return cat;
  }

  // 2. Publisher-based game detection
  if (p.publisher) {
    const pubLower = p.publisher.toLowerCase();
    if (GAME_PUBLISHERS.some((gp) => pubLower.includes(gp))) return "Games";
  }

  // 3. Keyword patterns
  for (const [re, cat] of CATEGORY_PATTERNS) {
    if (re.test(p.displayName)) return cat;
  }

  // 4. OpenShell pinned items default to Utilities
  if (p.source === "openshell") return "Utilities";

  return "Other";
}

// --- Source 1: Windows Registry ---
function getRegistryPrograms(): Program[] {
  const jsonFile = join(tmpdir(), `registry-data-${Date.now()}.json`);
  const psScript = `
$keys = @(
  "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
)
$results = @()
foreach ($key in $keys) {
  $items = Get-ItemProperty $key -ErrorAction SilentlyContinue |
    Select-Object DisplayName, DisplayVersion, Publisher, InstallDate
  if ($items) { $results += $items }
}
$json = $results | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText('${jsonFile.replace(/\\/g, "\\\\")}', $json, [System.Text.UTF8Encoding]::new($false))
`.trim();

  const tmpFile = join(tmpdir(), `registry-query-${Date.now()}.ps1`);
  writeFileSync(tmpFile, psScript, "utf-8");

  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });

    const output = readFileSync(jsonFile, "utf-8").trim();

    if (!output || output === "null") return [];

    const raw = JSON.parse(output);
    const items = Array.isArray(raw) ? raw : [raw];

    return items
      .filter((item: any) => item?.DisplayName?.trim())
      .map((item: any) => ({
        displayName: item.DisplayName.trim(),
        displayVersion: item.DisplayVersion?.trim() ?? "",
        publisher: item.Publisher?.trim() ?? "",
        installDate: item.InstallDate?.trim() ?? "",
        source: "registry" as const,
      }));
  } finally {
    try { unlinkSync(tmpFile); } catch {}
    try { unlinkSync(jsonFile); } catch {}
  }
}

// --- Source 2: Scoop ---
function getScoopPrograms(): Program[] {
  const output = execSync("scoop export", {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();

  const data = JSON.parse(output);
  return (data.apps ?? []).map((app: any) => ({
    displayName: app.Name ?? app.name ?? "",
    displayVersion: app.Version ?? app.version ?? "",
    publisher: "",
    installDate: "",
    source: "scoop" as const,
  }));
}

// --- Source 3: Winget ---
function getWingetPrograms(): Program[] {
  const output = execSync("winget list --source winget", {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  }).trim();

  const lines = output.split("\n");
  // Find the separator line (line of only dashes)
  const separatorIdx = lines.findIndex((l) => /^-{10,}$/.test(l.trim()));
  if (separatorIdx < 0 || separatorIdx + 1 >= lines.length) return [];

  const headerLine = lines[separatorIdx - 1];
  const header = headerLine.split(/\s{2,}/).map((h) => h.trim());
  const nameIdx = header.findIndex((h) => h === "Name");
  const versionIdx = header.findIndex((h) => h === "Version");

  return lines
    .slice(separatorIdx + 1)
    .filter((l) => l.trim() && !/^-{10,}$/.test(l.trim()))
    .map((line) => {
      const cols = line.split(/\s{2,}/).map((c) => c.trim());
      return {
        displayName: cols[nameIdx] ?? "",
        displayVersion: cols[versionIdx] ?? "",
        publisher: "",
        installDate: "",
        source: "winget" as const,
      };
    })
    .filter((p) => p.displayName);
}

// --- Source 4: OpenShell Pinned ---
function getOpenShellPrograms(): Program[] {
  const pinnedDir = join(
    process.env.APPDATA ?? "",
    "OpenShell",
    "Pinned"
  );

  const results: Program[] = [];

  function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".lnk")) {
        const name = basename(entry.name, ".lnk");
        if (name === "desktop.ini" || name === "startscreen") continue;
        results.push({
          displayName: name,
          displayVersion: "",
          publisher: "",
          installDate: "",
          source: "openshell" as const,
        });
      }
    }
  }

  walk(pinnedDir);
  return results;
}

// --- Main ---
function main() {
  console.log("Collecting installed programs...");

  console.log("  -> Windows Registry...");
  const registryRaw = getRegistryPrograms();
  console.log(`     Found ${registryRaw.length} programs`);

  console.log("  -> Scoop...");
  const scoopRaw = getScoopPrograms();
  console.log(`     Found ${scoopRaw.length} programs`);

  console.log("  -> Winget...");
  const wingetRaw = getWingetPrograms();
  console.log(`     Found ${wingetRaw.length} programs`);

  console.log("  -> OpenShell Pinned...");
  const openshellRaw = getOpenShellPrograms();
  console.log(`     Found ${openshellRaw.length} programs`);

  // Filter out non-user-installed programs
  const registry = registryRaw.filter((p) => !shouldFilterOut(p));
  const scoop = scoopRaw.filter((p) => !shouldFilterOut(p));
  const winget = wingetRaw.filter((p) => !shouldFilterOut(p));
  // OpenShell pinned are always user-curated — no filtering
  const openshell = openshellRaw;

  const filtered = {
    registry: registryRaw.length - registry.length,
    scoop: scoopRaw.length - scoop.length,
    winget: wingetRaw.length - winget.length,
  };
  console.log(
    `  Filtered out: ${filtered.registry} registry, ${filtered.scoop} scoop, ${filtered.winget} winget`
  );

  // Merge and deduplicate
  const registryNorm = new Map<string, Program>();
  for (const p of registry) {
    registryNorm.set(normalize(p.displayName), p);
  }

  const scoopNorm = new Map<string, Program>();
  for (const p of scoop) {
    scoopNorm.set(normalize(p.displayName), p);
  }

  const wingetNorm = new Map<string, Program>();
  for (const p of winget) {
    wingetNorm.set(normalize(p.displayName), p);
  }

  const openshellNorm = new Map<string, Program>();
  for (const p of openshell) {
    openshellNorm.set(normalize(p.displayName), p);
  }

  // Start with registry as base, merge scoop/winget versions
  const merged = new Map<string, Program>();

  for (const [norm, p] of registryNorm) {
    merged.set(norm, { ...p });
  }

  // Add scoop programs; if already in registry, prefer scoop version
  for (const [norm, p] of scoopNorm) {
    const existing = merged.get(norm);
    if (existing) {
      if (p.displayVersion && !existing.displayVersion) {
        existing.displayVersion = p.displayVersion;
      }
    } else {
      merged.set(norm, { ...p });
    }
  }

  // Add winget programs; if already in registry, prefer winget version
  for (const [norm, p] of wingetNorm) {
    const existing = merged.get(norm);
    if (existing) {
      if (p.displayVersion && !existing.displayVersion) {
        existing.displayVersion = p.displayVersion;
      }
    } else {
      merged.set(norm, { ...p });
    }
  }

  // Add openshell pinned programs only if not already present
  for (const [norm, p] of openshellNorm) {
    if (!merged.has(norm)) {
      merged.set(norm, { ...p });
    }
  }

  // Categorize all programs
  for (const p of merged.values()) {
    p.category = categorize(p);
  }

  // Sort: by category, then source, then alphabetically by display name
  const categoryOrder: Record<Category, number> = {
    Games: 0, Gaming: 1, Productivity: 2, Development: 3,
    Media: 4, Browsers: 5, Communication: 6, Utilities: 7, Other: 8,
  };
  const sourceOrder = { registry: 0, scoop: 1, winget: 2, openshell: 3 };
  const sorted = [...merged.values()].sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;
    const srcDiff = sourceOrder[a.source] - sourceOrder[b.source];
    if (srcDiff !== 0) return srcDiff;
    return a.displayName.localeCompare(b.displayName);
  });

  // Write CSV
  const header = "DisplayName,DisplayVersion,Publisher,InstallDate,Source,Category";
  const rows = sorted.map(
    (p) =>
      [
        escapeCsv(p.displayName),
        escapeCsv(p.displayVersion),
        escapeCsv(p.publisher),
        escapeCsv(p.installDate),
        p.source,
        p.category,
      ].join(",")
  );

  const csv = [header, ...rows].join("\n");

  const outDir = join(import.meta.dir, "..", "output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "InstalledPrograms.csv");
  writeFileSync(outPath, csv, "utf-8");

  console.log(`\nWrote ${sorted.length} programs to ${outPath}`);

  // Summary by source
  const sourceCounts: Record<string, number> = {};
  for (const p of sorted) {
    sourceCounts[p.source] = (sourceCounts[p.source] ?? 0) + 1;
  }
  console.log("By source:", sourceCounts);

  // Summary by category
  const catCounts: Record<string, number> = {};
  for (const p of sorted) {
    catCounts[p.category] = (catCounts[p.category] ?? 0) + 1;
  }
  console.log("By category:", catCounts);
}

main();
