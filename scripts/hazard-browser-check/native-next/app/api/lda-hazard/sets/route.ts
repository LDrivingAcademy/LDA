// Synthetic read-only UI catalogue. No auth service, DB, media or mutation routes.
export function GET(request:Request) {
  if(request.headers.get('host')!=='127.0.0.1:4390') return Response.json({error:'Loopback check only'},{status:403});
  return Response.json({available:true,active_attempt_id:null,sets:[
    {set_id:'fixture-1',title:'Software fixture — not training clips',clip_count:14}
  ]},{headers:{'cache-control':'no-store'}});
}
