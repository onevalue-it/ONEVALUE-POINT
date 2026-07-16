import { useStore } from "./store"

export function useLangText() {
  const lang = useStore(state => state.lang)
  return (vi: string, ja: string) => (lang === "ja" ? ja : vi)
}
