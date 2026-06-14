import { createRoot } from 'react-dom/client'
import './popup.css'
import { Popup } from './Popup'

const root = document.getElementById('root')!
createRoot(root).render(<Popup />)
