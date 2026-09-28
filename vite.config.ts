import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serverer appen under /<repo-navn>/, så alle stier skal have det præfiks.
// Kan overskrives med VITE_BASE, fx "/" ved lokal udvikling eller et eget domæne.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE || (command === 'build' ? '/MatchFlick/' : '/'),
  plugins: [react()],
}))
