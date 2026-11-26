"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@poweros/ui";
/** Uses the browser's BarcodeDetector when present (Chrome/Android), otherwise ZXing. Needs HTTPS and camera permission. */
export function CameraScanner({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null); const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return; setErr(""); let stop = false, done = false; let stream: MediaStream | null = null; let controls: any;
    const hit = (code: string) => { if (done || stop) return; done = true; navigator.vibrate?.(60);
      try { const a = new AudioContext(), o = a.createOscillator(); o.frequency.value = 1100; o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.1); } catch {}
      onResult(code.trim()); onClose(); };
    (async () => {
      try {
        if ("BarcodeDetector" in window) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); video.current!.srcObject = stream; await video.current!.play();
          const det = new (window as any).BarcodeDetector({ formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39"] });
          const tick = async () => { if (stop) return; try { const r = await det.detect(video.current!); if (r[0]) return hit(r[0].rawValue); } catch {} requestAnimationFrame(tick); }; tick();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          controls = await new BrowserMultiFormatReader().decodeFromVideoDevice(undefined, video.current!, (res) => { if (res) hit(res.getText()); });
        }
      } catch { setErr("The camera is not available. Allow camera access in your browser, or type the barcode instead."); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); try { controls?.stop(); } catch {} };
  }, [open]);
  return (<Modal open={open} onClose={onClose} title="Scan barcode" subtitle="Hold the barcode inside the frame">
    <div className="p-4">{err ? <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{err}</p> :
      <div className="relative overflow-hidden rounded-2xl bg-black"><video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" />
        <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" />
        <motion.div className="pointer-events-none absolute inset-x-8 h-0.5 bg-gold-400 shadow-[0_0_16px_4px_rgba(217,162,94,.8)]" animate={{ top: ["20%", "78%"] }} transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.2 }} /></div>}</div></Modal>);
}
