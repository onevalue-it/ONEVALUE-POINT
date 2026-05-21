import { useStore } from "./store"
import { translations } from "./i18n"

export function useT() {
  const lang = useStore(s => s.lang)
  return translations[lang]
}
