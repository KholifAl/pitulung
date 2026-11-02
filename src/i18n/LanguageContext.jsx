import { createContext, useContext } from 'react'

export const LanguageContext = createContext({
  lang: 'id',
  setLang: () => {},
})

export function useLanguage() {
  return useContext(LanguageContext)
}
