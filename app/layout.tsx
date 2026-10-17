import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'夜の栞 — 仲間とひらく、小さな謎。',description:'手がかりを持ち寄って物語の真相を解く、1〜4人の協力型ミステリー。',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>}
