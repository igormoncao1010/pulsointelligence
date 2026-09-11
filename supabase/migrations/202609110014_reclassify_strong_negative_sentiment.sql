-- Reclassifica menções já armazenadas que contêm acusações ou termos hostis inequívocos.
-- Os próximos itens são classificados pelo motor contextual-pt-v3 da aplicação.
update public.sentiment_analysis as sa
set sentiment = 'negative',
    score = least(coalesce(sa.score, 0), -0.65),
    confidence = greatest(coalesce(sa.confidence, 0), 0.85),
    provider = 'internal-reclassification',
    model = 'contextual-pt-v3'
from public.articles as a
where a.id = sa.article_id
  and concat_ws(' ', a.title, a.description, a.content) ~* '(ladr[aã]o|ladrões|ladroes|bandid[oa]s?|criminos[oa]s?|quadrilha|roubando|roubou|rouba|roubar|roubo|corrup[cç][aã]o|corrupt[oa]s?|fraude|golpe|golpistas?|mensal[aã]o|petrol[aã]o|esc[aâ]ndalos?|gastos? exorbitantes?|falta de (comida|seguran[cç]a|educa[cç][aã]o|sa[uú]de|emprego|moradia)|sal[aá]rios? atrasados?|inseguran[cç]a|fome|desvios?|superfaturamento|abandono|descaso)';
