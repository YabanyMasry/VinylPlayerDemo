import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { LocalPlayerProvider } from './state/LocalPlayerContext'
import './index.css'
import './mockBackend'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LocalPlayerProvider>
        <App />
      </LocalPlayerProvider>
    </BrowserRouter>
  </StrictMode>
)
