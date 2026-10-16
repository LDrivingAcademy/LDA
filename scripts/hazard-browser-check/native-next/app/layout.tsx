import type {ReactNode} from 'react';
import './globals.css';
export const metadata={title:'LOCAL LDA native Next.js verification — not training'};
export default function Layout({children}:{children:ReactNode}) {
  return <html lang="en"><body style={{fontFamily:'system-ui'}}>
    <p className="bg-red-950 p-4 font-bold text-white">LOCAL SOFTWARE CHECK — NOT A LIVE RELEASE</p>
    {children}
  </body></html>;
}
