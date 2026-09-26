'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export default function OperationsRefresh({label}:{label:string}){const router=useRouter();useEffect(()=>{const id=setInterval(()=>{if(document.visibilityState==='visible')router.refresh();},10000);return()=>clearInterval(id);},[router]);return <button className="button secondary" onClick={()=>router.refresh()}>{label}</button>;}
