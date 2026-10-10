"use client";

import { useEffect } from "react";
import { captureUtm } from "./submit";

/** Сохраняет UTM из URL первой страницы визита в sessionStorage. */
export default function UtmCapture() {
  useEffect(() => {
    captureUtm();
  }, []);
  return null;
}
