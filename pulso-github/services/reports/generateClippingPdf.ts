import { jsPDF } from 'jspdf';

type Mention={id:string;matched_text?:string|null;created_at:string;articles:{title:string;description:string|null;author?:string|null;url:string;published_at:string|null;sources:{name:string;source_type:string}|null}|null;monitors:{name:string}|null};
const clean=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'');

export function generateClippingPdf(items:Mention[]){
  if(!items.length)return;
  const doc=new jsPDF(),width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight(),margin=16;let y=22;
  const page=()=>{doc.addPage();y=20};const ensure=(needed:number)=>{if(y+needed>height-18)page()};
  doc.setFillColor(15,23,42);doc.rect(0,0,width,42,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text('PULSO MEDIA INTELLIGENCE',margin,19);doc.setFontSize(11);doc.setFont('helvetica','normal');doc.text(`Clipping selecionado · ${items.length} publicacoes`,margin,30);doc.text(new Date().toLocaleString('pt-BR'),width-margin,19,{align:'right'});y=54;
  items.forEach((item,index)=>{const article=item.articles,title=clean(article?.title||'Publicacao sem titulo'),description=clean(article?.description||item.matched_text||'Sem descricao.'),meta=clean(`${article?.sources?.name||'Fonte'} · ${item.monitors?.name||'Monitor'} · ${new Date(article?.published_at||item.created_at).toLocaleString('pt-BR')}`),body=doc.splitTextToSize(description,width-margin*2),titleLines=doc.splitTextToSize(`${index+1}. ${title}`,width-margin*2);ensure(20+titleLines.length*6+body.length*4.5);doc.setTextColor(37,99,235);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(meta,margin,y);y+=6;doc.setTextColor(15,23,42);doc.setFontSize(11);doc.text(titleLines,margin,y);y+=titleLines.length*5.5+2;doc.setTextColor(71,85,105);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(body,margin,y);y+=body.length*4.3+3;if(article?.url){doc.setTextColor(37,99,235);doc.setFontSize(7);const links=doc.splitTextToSize(clean(article.url),width-margin*2);doc.textWithLink(links[0],margin,y,{url:article.url});y+=5}doc.setDrawColor(226,232,240);doc.line(margin,y,width-margin,y);y+=8});
  const pages=doc.getNumberOfPages();for(let index=1;index<=pages;index++){doc.setPage(index);doc.setFontSize(7);doc.setTextColor(148,163,184);doc.text(`Pagina ${index} de ${pages}`,width-margin,height-8,{align:'right'})}
  doc.save(`pulso-clipping-${new Date().toISOString().slice(0,10)}.pdf`);
}
