import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 등 서브 디렉토리에 배포될 경우를 대비해 상대 경로 사용
  base: './' 
})