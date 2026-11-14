export type ApprovalQuantity={request_id:string;approved_quantity:number};
export function readApprovalQuantities(raw:string,requests:readonly {id:string;quantity:number}[],reason:string):ApprovalQuantity[]{
  const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data)||data.length!==requests.length||!data.length)throw new Error('Enter an approved quantity for every selected request.');
  const map=new Map(requests.map(r=>[r.id,r.quantity])),seen=new Set<string>();
  const result=data.map(row=>{
    if(!row||typeof row!=='object'||typeof row.request_id!=='string'||!map.has(row.request_id)||seen.has(row.request_id))throw new Error('Check the selected requests and try again.');
    seen.add(row.request_id);
    const value=row.approved_quantity;
    if((typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&!value.trim()))throw new Error('Enter a whole approved quantity for every item.');
    const quantity=Number(value);
    if(!Number.isInteger(quantity)||quantity<0||quantity>map.get(row.request_id)!||quantity>10000000)throw new Error('Approved quantities must be whole numbers from 0 up to the quantity requested.');
    return {request_id:row.request_id,approved_quantity:quantity};
  });
  if(reason.trim().length>500)throw new Error('Keep the reason to 500 characters or fewer.');
  if(result.some(row=>row.approved_quantity<map.get(row.request_id)!)&&!reason.trim())throw new Error('Enter a reason for approving fewer items or rejecting an item.');
  return result;
}
