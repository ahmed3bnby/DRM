import {z} from 'zod';
const address=z.object({addressLines:z.array(z.string()).default([]),city:z.string().nullable().optional(),country:z.string().nullable().optional()}).passthrough();
const record=z.object({id:z.string().regex(/^[A-Z0-9]{20}$/),attributes:z.object({entity:z.object({legalName:z.object({name:z.string()}),legalAddress:address,registeredAs:z.string().nullable().optional(),status:z.string().optional(),creationDate:z.string().nullable().optional()}),registration:z.object({status:z.string(),lastUpdateDate:z.string()})})});
export type CompanyRecord=z.infer<typeof record>;
export async function gleifSearch(q:string):Promise<{status:'not_searched'|'searched'|'failed';records:CompanyRecord[];total?:number;retrievedAt?:string;publishedAt?:string}>{
 if(q.trim().length<3||q.length>160)return {status:'not_searched',records:[]};
 const url=new URL('https://api.gleif.org/api/v1/lei-records');url.searchParams.set('filter[entity.legalName]',q.trim());url.searchParams.set('page[size]','10');
 try{const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(2000),headers:{Accept:'application/vnd.api+json'}});if(!response.ok)throw Error('Unavailable');const raw=await response.text();if(raw.length>2000000)throw Error('Oversized response');const data=z.object({data:z.array(record),meta:z.object({pagination:z.object({total:z.number()}),goldenCopy:z.object({publishDate:z.string()}).optional()})}).parse(JSON.parse(raw));return {status:'searched',records:data.data,total:data.meta.pagination.total,retrievedAt:new Date().toISOString(),publishedAt:data.meta.goldenCopy?.publishDate};}catch{return {status:'failed',records:[]};}
}
