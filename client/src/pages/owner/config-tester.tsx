import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Copy, FlaskConical, Wifi, Shield, Zap, Globe, ChevronLeft, Info, CheckCircle2, XCircle } from "lucide-react";

const SNI_PRESETS = [
  { label: "Facebook", value: "m.facebook.com", carrier: "آسياسيل" },
  { label: "WhatsApp", value: "web.whatsapp.com", carrier: "آسياسيل/زين" },
  { label: "Instagram", value: "www.instagram.com", carrier: "آسياسيل/زين" },
  { label: "Instagram CDN", value: "scontent.cdninstagram.com", carrier: "زين" },
  { label: "Facebook Graph", value: "graph.facebook.com", carrier: "آسياسيل" },
  { label: "Facebook Static", value: "static.xx.fbcdn.net", carrier: "آسياسيل" },
  { label: "TikTok", value: "www.tiktok.com", carrier: "بعض الباقات" },
  { label: "Snapchat", value: "app.snapchat.com", carrier: "بعض الباقات" },
  { label: "YouTube", value: "www.youtube.com", carrier: "باقات يوتيوب" },
  { label: "Google", value: "www.google.com", carrier: "تجريبي" },
];

const TRANSPORT_TYPES = [
  {
    value: "ws_tls",
    label: "WebSocket + TLS",
    icon: <Wifi className="w-4 h-4" />,
    description: "الأكثر استخداماً — يتنكر بـ SNI مع تشفير TLS",
    difficulty: "سهل",
    serverNeeds: "VLESS_WS inbound (موجود)",
  },
  {
    value: "ws_none",
    label: "WebSocket بدون TLS",
    icon: <Globe className="w-4 h-4" />,
    description: "حقن بـ Host header بدون تشفير — يشتغل مع بعض الباقات",
    difficulty: "سهل",
    serverNeeds: "VLESS_WS inbound (موجود)",
  },
  {
    value: "grpc_tls",
    label: "gRPC + TLS",
    icon: <Zap className="w-4 h-4" />,
    description: "بروتوكول أسرع وأصعب اكتشافه — يحتاج إعداد سيرفر",
    difficulty: "متوسط",
    serverNeeds: "يحتاج VLESS_GRPC inbound جديد",
  },
  {
    value: "tcp_http",
    label: "TCP + HTTP Obfuscation",
    icon: <Shield className="w-4 h-4" />,
    description: "يغلّف الترافك كأنه HTTP عادي — طريقة قديمة بس تشتغل",
    difficulty: "سهل",
    serverNeeds: "يحتاج إعداد سيرفر",
  },
  {
    value: "httpupgrade_tls",
    label: "HTTP Upgrade + TLS",
    icon: <ArrowRight className="w-4 h-4" />,
    description: "مشابه لـ WebSocket بس يستخدم HTTP Upgrade — أحدث",
    difficulty: "متوسط",
    serverNeeds: "يحتاج VLESS_HTTPUPGRADE inbound جديد",
  },
];

export default function ConfigTester() {
  const { toast } = useToast();
  const [transport, setTransport] = useState("ws_tls");
  const [sni, setSni] = useState("m.facebook.com");
  const [customSni, setCustomSni] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("443");
  const [path, setPath] = useState("/vlessws");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedConfig, setGeneratedConfig] = useState("");
  const [testResults, setTestResults] = useState<Array<{ sni: string; transport: string; status: string }>>([]);

  const activeSni = customSni || sni;
  const activeHost = host || activeSni;

  function generateTestConfig() {
    const testUUID = "test-0000-0000-0000-000000000000";
    const domain = "mohmmedvpn.com";
    const remarkName = encodeURIComponent(`Test - ${activeSni}`);

    let vlessLink = "";
    let configJson: any = {};

    const baseOutbound: any = {
      protocol: "vless",
      settings: {
        vnext: [{
          address: domain,
          port: parseInt(port),
          users: [{ encryption: "none", id: testUUID, level: 8, security: "auto" }]
        }]
      },
      tag: "proxy"
    };

    if (transport === "ws_tls") {
      baseOutbound.streamSettings = {
        network: "ws",
        security: "tls",
        tlsSettings: { allowInsecure: true, serverName: activeSni },
        wsSettings: { path: path, headers: { Host: activeHost } }
      };
      vlessLink = `vless://${testUUID}@${domain}:${port}?security=tls&type=ws&path=${encodeURIComponent(path)}&host=${activeHost}&sni=${activeSni}&allowInsecure=1#${remarkName}`;
    } else if (transport === "ws_none") {
      baseOutbound.streamSettings = {
        network: "ws",
        security: "none",
        wsSettings: { path: path, headers: { Host: activeHost } }
      };
      vlessLink = `vless://${testUUID}@${domain}:${port}?security=none&type=ws&path=${encodeURIComponent(path)}&host=${activeHost}#${remarkName}`;
    } else if (transport === "grpc_tls") {
      baseOutbound.streamSettings = {
        network: "grpc",
        security: "tls",
        tlsSettings: { allowInsecure: true, serverName: activeSni },
        grpcSettings: { serviceName: "vlessgrpc" }
      };
      vlessLink = `vless://${testUUID}@${domain}:${port}?security=tls&type=grpc&serviceName=vlessgrpc&sni=${activeSni}&allowInsecure=1#${remarkName}`;
    } else if (transport === "tcp_http") {
      baseOutbound.streamSettings = {
        network: "tcp",
        security: "none",
        tcpSettings: {
          header: {
            type: "http",
            request: {
              version: "1.1",
              method: "GET",
              path: ["/"],
              headers: { Host: [activeHost], "User-Agent": ["Mozilla/5.0"], Connection: ["keep-alive"] }
            }
          }
        }
      };
      vlessLink = `vless://${testUUID}@${domain}:${port}?security=none&type=tcp&headerType=http&host=${activeHost}#${remarkName}`;
    } else if (transport === "httpupgrade_tls") {
      baseOutbound.streamSettings = {
        network: "httpupgrade",
        security: "tls",
        tlsSettings: { allowInsecure: true, serverName: activeSni },
        httpupgradeSettings: { path: path, host: activeHost }
      };
      vlessLink = `vless://${testUUID}@${domain}:${port}?security=tls&type=httpupgrade&path=${encodeURIComponent(path)}&host=${activeHost}&sni=${activeSni}&allowInsecure=1#${remarkName}`;
    }

    configJson = {
      dns: { hosts: { "domain:googleapis.cn": "googleapis.com" }, servers: ["1.1.1.1"] },
      inbounds: [
        { listen: "127.0.0.1", port: 10808, protocol: "socks", settings: { auth: "noauth", udp: true, userLevel: 8 }, sniffing: { destOverride: ["http", "tls"], enabled: true }, tag: "socks" },
        { listen: "127.0.0.1", port: 10809, protocol: "http", settings: { userLevel: 8 }, tag: "http" }
      ],
      log: { loglevel: "warning" },
      outbounds: [baseOutbound, { protocol: "freedom", settings: {}, tag: "direct" }, { protocol: "blackhole", settings: { response: { type: "http" } }, tag: "block" }],
      remarks: `Test - ${activeSni}`,
      routing: { domainStrategy: "IPIfNonMatch", rules: [{ ip: ["1.1.1.1"], outboundTag: "proxy", port: "53", type: "field" }] }
    };

    setGeneratedLink(vlessLink);
    setGeneratedConfig(JSON.stringify(configJson, null, 2));
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: `تم نسخ ${label}` });
  }

  function markResult(status: string) {
    setTestResults(prev => [
      { sni: activeSni, transport: TRANSPORT_TYPES.find(t => t.value === transport)?.label || transport, status },
      ...prev
    ]);
  }

  const selectedTransport = TRANSPORT_TYPES.find(t => t.value === transport);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/owner">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <FlaskConical className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">مختبر الكونفقات</h1>
            <p className="text-sm text-muted-foreground">جرّب إعدادات مختلفة واكتشف الثغرات</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                نوع النقل (Transport)
              </CardTitle>
              <CardDescription>اختر طريقة الاتصال</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {TRANSPORT_TYPES.map(t => (
                <div
                  key={t.value}
                  data-testid={`transport-${t.value}`}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${transport === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  onClick={() => setTransport(t.value)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {t.icon}
                    <span className="font-medium text-sm">{t.label}</span>
                    <Badge variant="outline" className="text-[10px] mr-auto">{t.difficulty}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    <Info className="w-3 h-3 inline ml-1" />
                    {t.serverNeeds}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="w-5 h-5 text-green-500" />
                  إعدادات SNI
                </CardTitle>
                <CardDescription>اختر أو اكتب SNI للتجربة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>SNI جاهز</Label>
                  <Select value={sni} onValueChange={(v) => { setSni(v); setCustomSni(""); }}>
                    <SelectTrigger data-testid="select-sni">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SNI_PRESETS.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label} — {s.value} ({s.carrier})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>أو اكتب SNI مخصص</Label>
                  <Input
                    data-testid="input-custom-sni"
                    placeholder="مثال: api.twitter.com"
                    value={customSni}
                    onChange={e => setCustomSni(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Host Header (اختياري — نفس الـ SNI لو فارغ)</Label>
                  <Input
                    data-testid="input-host"
                    placeholder={activeSni}
                    value={host}
                    onChange={e => setHost(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  إعدادات الاتصال
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>البورت</Label>
                    <Select value={port} onValueChange={setPort}>
                      <SelectTrigger data-testid="select-port">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="443">443 (HTTPS)</SelectItem>
                        <SelectItem value="80">80 (HTTP)</SelectItem>
                        <SelectItem value="8080">8080</SelectItem>
                        <SelectItem value="8443">8443</SelectItem>
                        <SelectItem value="2053">2053</SelectItem>
                        <SelectItem value="2083">2083</SelectItem>
                        <SelectItem value="2087">2087</SelectItem>
                        <SelectItem value="2096">2096</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>المسار (Path)</Label>
                    <Input
                      data-testid="input-path"
                      value={path}
                      onChange={e => setPath(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-1">الإعدادات الحالية:</p>
                <p className="text-xs text-muted-foreground">
                  {selectedTransport?.label} | SNI: {activeSni} | Port: {port} | Host: {activeHost} | Path: {path}
                </p>
              </div>
              <Button data-testid="button-generate" size="lg" onClick={generateTestConfig}>
                <FlaskConical className="w-4 h-4 ml-2" />
                توليد كونفق تجريبي
              </Button>
            </div>

            {generatedLink && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">رابط VLESS مباشر:</p>
                    <Button data-testid="button-copy-vless" variant="outline" size="sm" onClick={() => copyToClipboard(generatedLink, "رابط VLESS")}>
                      <Copy className="w-3 h-3 ml-1" />نسخ
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground break-all font-mono" dir="ltr" data-testid="text-vless-link">{generatedLink}</p>
                </div>

                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">JSON Config:</p>
                    <Button data-testid="button-copy-json" variant="outline" size="sm" onClick={() => copyToClipboard(generatedConfig, "JSON Config")}>
                      <Copy className="w-3 h-3 ml-1" />نسخ
                    </Button>
                  </div>
                  <pre className="text-[10px] text-muted-foreground max-h-40 overflow-y-auto font-mono" dir="ltr" data-testid="text-json-config">{generatedConfig}</pre>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ هذا كونفق تجريبي بـ UUID وهمي. انسخ رابط الـ VLESS وبدّل الـ UUID بـ UUID حقيقي من Marzban عشان تجربه. أو استخدم الـ API: <code dir="ltr">/configs/CODE.json?type=ws&sni=X&port=Y</code>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button data-testid="button-mark-success" variant="outline" className="text-green-600 border-green-300" onClick={() => markResult("شغال ✅")}>
                    <CheckCircle2 className="w-4 h-4 ml-1" />شغال
                  </Button>
                  <Button data-testid="button-mark-fail" variant="outline" className="text-red-600 border-red-300" onClick={() => markResult("ما يشتغل ❌")}>
                    <XCircle className="w-4 h-4 ml-1" />ما يشتغل
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">نتائج التجارب</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {testResults.map((r, i) => (
                  <div key={i} data-testid={`result-row-${i}`} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{r.transport}</span>
                      <span className="text-muted-foreground text-xs">{r.sni}</span>
                    </div>
                    <Badge variant={r.status.includes("✅") ? "default" : "destructive"}>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">دليل الاختبار</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">📋 خطوات التجربة:</h3>
                <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                  <li>اختر نوع النقل والـ SNI</li>
                  <li>اضغط "توليد كونفق تجريبي"</li>
                  <li>انسخ رابط الـ VLESS</li>
                  <li>بدّل الـ UUID بـ UUID حقيقي</li>
                  <li>ضيفه بـ NPV Tunnel</li>
                  <li>شغّله وشوف الداون لنك</li>
                  <li>سجّل النتيجة (شغال/ما يشتغل)</li>
                </ol>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">💡 نصائح:</h3>
                <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                  <li>جرّب كل SNI مع باقتك الحالية</li>
                  <li>لو SNI ما يشتغل، جرب واحد ثاني</li>
                  <li>بورت 443 الأكثر نجاحاً</li>
                  <li>WebSocket + TLS الأسهل والأنجح</li>
                  <li>بعض الثغرات تشتغل بوقت معيّن وتنسد</li>
                  <li>الثغرات تتغيّر — اللي يشتغل اليوم ممكن ينسد بكرة</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
