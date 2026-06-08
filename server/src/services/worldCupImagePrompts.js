const MAIN_IMAGE_ID = '01-figurinha-principal';

const IMAGE_SPECS = [
  {
    id: MAIN_IMAGE_ID,
    title: 'Figurinha Principal',
    kind: 'main',
    filename: '01-figurinha-principal',
    aspect: 'portrait',
    transparent: false,
    buildPrompt: buildMainCardPrompt,
  },
  {
    id: '02-grito-de-gol',
    title: 'O Grito de Gol',
    kind: 'sticker',
    filename: '02-grito-de-gol',
    transparent: true,
    prompt: `
Analise a imagem fornecida.
Guardrails: identifique a pessoa principal, ou o grupo, em primeiro plano. Mantenha estritamente a semelhanca facial, etnia, corte de cabelo e roupas de base. Se houver oculos de grau na referencia, preserve fielmente o design e as cores exatas da armacao, garantindo especificamente que o padrao amarelo e preto nao seja alterado ou ignorado. Se a referencia nao tiver oculos, mantenha o rosto sem oculos e nao invente armacao.
Acao: recrie os sujeitos em um estilo de ilustracao 3D tipo Pixar. Altere a expressao original para uma comemoracao de "GOL!" euforica: bocas bem abertas gritando, olhos fechados.
Elementos tematicos: adicione pinturas faciais da bandeira do Brasil. Coloque confetes verdes e amarelos explodindo ao redor.
Acabamento: fundo 100% transparente, canal alfa real, sem cor solida, sombra projetada ou cenario externo, pronto para uso como figurinha.
`.trim(),
  },
  {
    id: '03-sufoco-dos-penaltis',
    title: 'O Sufoco dos Penaltis',
    kind: 'sticker',
    filename: '03-sufoco-dos-penaltis',
    transparent: true,
    prompt: `
Analise a imagem fornecida.
Guardrails: foque na pessoa, ou grupo, em primeiro plano. A semelhanca facial, estrutura do rosto e caracteristicas unicas devem ser preservadas fielmente. Se a referencia tiver oculos de grau, mantenha intacto o formato e as cores amarelo e preto. Se a referencia nao tiver oculos, nao adicione oculos, armacao ou lente.
Acao: transforme a foto em uma caricatura 3D expressiva. Mude a postura para ansiedade maxima: olhos arregalados, gotas de suor na testa e as maos trazidas ao rosto roendo as unhas de forma exagerada.
Elementos tematicos: vista a pessoa com a camiseta padrao do projeto: camiseta de jogo do Brasil lisa, sem marca e sem numero, com gola em V verde, barra das mangas verde e restante da camiseta amarelo. Pode colocar uma faixa de suor escrita "BRASIL" na cabeca.
Enquadramento obrigatorio: a cabeca, o cabelo completo, a testa, a faixa se existir, as orelhas, os ombros, as maos e a camiseta devem aparecer 100% dentro do canvas. Nao use close-up extremo. Deixe margem transparente ampla acima do cabelo ou da faixa, no minimo 16% da altura do canvas. Se a pose ansiosa com maos no rosto ocupar muito espaco, reduza a escala do personagem inteiro para caber sem cortar topo da cabeca, laterais do cabelo, dedos ou ombros.
Acabamento: fundo completamente transparente, isolando apenas os personagens para exportacao direta como PNG transparente, sem borda ou contorno externo.
`.trim(),
  },
  {
    id: '04-pedindo-o-var',
    title: 'Pedindo o VAR',
    kind: 'sticker',
    filename: '04-pedindo-o-var',
    transparent: true,
    prompt: `
Analise a imagem anexada.
Guardrails: isole as pessoas em primeiro plano. Mantenha a integridade das identidades visuais: rostos, cabelos e aderecos faciais. Se a referencia tiver oculos de grau, mantenha a exata paleta de cores amarela e preta. Se a referencia nao tiver oculos, mantenha o rosto sem oculos. Ignore pessoas desfocadas ao fundo.
Acao: substitua o gesto antigo de quadrado com as maos por uma cena inspirada em arbitro de VAR. A pessoa deve usar um headset discreto de operador/arbitro, com arco fino e microfone lateral perto da boca. A expressao deve ser de concentracao indignada e ceticismo, com sobrancelhas franzidas.
Pose: a pessoa deve estar virada de frente para a camera, com o tronco frontal e rosto olhando para frente. Os dois bracos devem estar abertos, um para cada lado, com as maos posicionadas perto das extremidades inferiores da armação retangular de gol. As maos devem estar fechadas como punhos, com somente o dedo indicador de cada mao estendido. Use a perspectiva anatomica da pessoa: a mao direita da pessoa, que aparece no lado esquerdo da imagem para quem observa, deve apontar diretamente para a extremidade inferior do poste esquerdo, no canto inferior esquerdo da armação do gol. A mao esquerda da pessoa, que aparece no lado direito da imagem para quem observa, deve apontar diretamente para a extremidade inferior do poste direito, no canto inferior direito da armação do gol. A trave deve ficar alta, acima da cabeca e dos ombros, e os postes verticais devem comecar exatamente onde terminam as pontas dos dedos indicadores. A ponta de cada indicador deve tocar ou quase tocar a base inferior do respectivo poste; a trave inteira sobe a partir dessas pontas dos dedos. Nao coloque a trave baixa ao redor do peito, cintura ou maos. Os indicadores nao devem apontar para o meio dos postes, para o travessao superior ou para o centro do gol. Nao inverta as maos, nao cruze os bracos, nao fazer sinal de quadrado com as maos e nao juntar as maos na frente do peito.
Anatomia das maos: cada mao deve aparecer como punho fechado com apenas um indicador visivel e estendido. Os outros quatro dedos de cada mao devem ficar recolhidos no punho, sem aparecerem como dedos soltos. A mao esquerda deve ter exatamente cinco dedos totais. A mao direita deve ter exatamente cinco dedos totais. Nao crie sexto dedo, dedo extra, dedo duplicado, dedo solto no meio da composicao, dedo vertical cruzando a area do gol, dedos fundidos, dedos repetidos ou palmas deformadas.
Elementos tematicos: adicione somente a face frontal de uma trave simples de gol em vermelho ou laranja, composta por exatamente tres segmentos retos: um poste vertical esquerdo, um poste vertical direito e um travessao superior horizontal. Dentro da area do gol, adicione um balaozinho arredondado com o texto "VAR" em branco. O balao deve ficar dentro da armação do gol e nao pode cobrir o rosto da pessoa.
Trave obrigatoria: desenhe apenas a frente plana 2D da trave do gol, como um icone simples em formato de U invertido ou letra grega pi. Use uma unica linha/haste para cada poste e uma unica linha/haste para o travessao. A parte inferior de cada poste deve ficar alinhada com a ponta do indicador correspondente, como se cada dedo estivesse segurando/apontando para a base do poste. Os postes devem subir verticalmente a partir das pontas dos dedos, e o travessao deve ficar claramente acima da cabeca. Nao desenhe qualquer trecho de poste abaixo das pontas dos dedos. Nao desenhe perspectiva, profundidade, espessura 3D, segundo contorno paralelo, postes laterais, barras traseiras, linha inferior, base no chao, rede, grade, malha, quadriculado, fios, sombras de rede, linhas internas, retangulo duplicado, trave de fundo ou qualquer parte traseira do gol. A area interna do gol deve ficar limpa e transparente, exceto pelo balao "VAR". Se houver duvida, prefira desenhar somente tres linhas simples e nada mais.
Acabamento: fundo estritamente transparente, sem preenchimento branco ou colorido.
`.trim(),
  },
  {
    id: '05-rei-da-torcida',
    title: 'O Rei da Torcida',
    kind: 'sticker',
    filename: '05-rei-da-torcida',
    transparent: true,
    prompt: `
Analise a selfie fornecida.
Guardrails: mantenha a expressao original, os tracos faciais e a pose exata da pessoa ou grupo existente na referencia. Se a referencia tiver oculos, replique a armacao amarela e preta com maxima fidelidade. Se a referencia nao tiver oculos, nao adicione oculos. Nao adicione novas pessoas, rostos, mascotes, bonecos humanos ou personagens extras.
Acao e elementos tematicos: coloque uma coroa de rei da torcida sobre a cabeca da pessoa existente, ou sobre cada pessoa existente em primeiro plano quando houver grupo real. A coroa deve ser divertida, verde e amarela, com detalhes dourados e pequenas estrelas, sem parecer uma taca ou chapeu gigante. A coroa deve ter tamanho medio-grande, mas nunca tao grande que encoste nas bordas ou seja cortada.
Enquadramento obrigatorio da coroa: a coroa e parte essencial da figurinha e deve aparecer 100% visivel dentro do canvas. Deixe uma margem transparente ampla acima da coroa e nas laterais, no minimo 18% da altura do canvas acima do ponto mais alto da coroa. Nao corte a ponta superior, joias, estrelas, esferas, bordas laterais ou qualquer detalhe da coroa. Se necessario, reduza fortemente o tamanho da pessoa e afaste o enquadramento para caber cabeca, coroa inteira, ombros, bracos e maos. A coroa deve ficar sobre a cabeca, centralizada, sem sair para fora do quadro, sem tocar nas bordas do canvas e com espaco transparente visivel acima do ponto mais alto.
Regra de escala da coroa: antes de finalizar, verifique o topo da coroa, pontas, estrelas e esferas. Se qualquer parte da coroa ficar a menos de 18% da borda superior ou a menos de 10% das laterais, diminua a escala de todo o personagem ate sobrar margem transparente. E melhor a pessoa ficar menor no canvas do que cortar qualquer parte da coroa.
Enquadramento geral: a pessoa inteira e a coroa devem aparecer completamente dentro da imagem, com margem transparente ao redor. Nao corte cabeca, cabelo, coroa, bracos, maos, ombros, camiseta, acessorios ou qualquer parte importante da silhueta.
Borda proibida: nao desenhe nenhum contorno externo ao redor da pessoa, da coroa, da camiseta ou da silhueta. Nao crie borda branca fina, borda branca grossa, stroke branco, outline, halo, brilho externo, margem adesivada, recorte colante, sombra clara ou qualquer linha branca acompanhando o corpo. A transicao entre personagem/coroa e fundo deve ser diretamente para alfa transparente, sem pixels brancos de separacao.
Acabamento: remova totalmente o cenario original e exporte com fundo transparente real. Nao adicione borda, stroke, outline, halo, brilho externo ou contorno branco ao redor da silhueta.
`.trim(),
  },
  {
    id: '06-hexa-vem',
    title: 'O Hexa Vem',
    kind: 'sticker',
    filename: '06-hexa-vem',
    transparent: true,
    prompt: `
Analise a imagem fornecida e mantenha a pessoa ou grupo em enquadramento de busto/peito, nao apenas close no rosto.
Guardrails: preserve a identidade, o corte de cabelo e as proporcoes do rosto perfeitamente. Preserve exatamente o cabelo da referencia: cor, raiz, comprimento, volume, textura, cachos/ondas/liso, linha do cabelo, laterais, topo da cabeca e fios soltos. Nao pinte, nao altere a cor, nao simplifique, nao alise, nao aumente volume e nao mude o penteado.
Enquadramento obrigatorio: a cabeca e o cabelo completo devem aparecer 100% dentro do canvas, com margem transparente visivel acima do topo do cabelo e nas laterais. Nao corte cabelo, topo da cabeca, orelhas, testa, laterais do rosto, barba, pescoço, ombros ou camiseta. Se o oculos "HEXA" ocupar muito espaco, reduza levemente a escala do personagem para preservar cabelo inteiro e margem transparente.
Acao importante: substitua temporariamente os oculos de grau originais da foto pelo elemento tematico abaixo, ajustando-o perfeitamente ao rosto.
Elementos tematicos: adicione um oculos tipografico frontal, reto e simetrico, estilo oculos de festa, em que a propria palavra "HEXA" forma a estrutura do oculos. O texto deve ser exatamente "HEXA", com quatro letras e somente quatro letras: H, E, X, A. As letras devem ser grandes, em bloco 3D arredondado, com frente verde e amarela, contorno verde escuro fino e sem lentes transparentes. O X deve funcionar como a ponte central sobre o nariz.
Padrao visual obrigatorio do oculos: uma unica palavra "HEXA" horizontal, centralizada sobre os olhos, sem inclinacao forte, sem faixa, sem banner, sem reflexo de texto, sem segunda camada de texto, sem palavra repetida e sem qualquer elemento lateral que pareca uma letra ou numero. O oculos deve cobrir somente a regiao dos olhos; nao deve empurrar, cortar ou esconder o topo do cabelo. Nao desenhe hastes laterais visiveis, blocos, retangulos ou extensoes depois da letra A ou antes da letra H.
Texto proibido: nao escreva "HEXA1", "HEXA!", "HEXAA", "HEXA VEM", "O HEXA", "HEXA6", "HEXA0" ou qualquer variacao. Nao adicione numeral 1, ponto de exclamacao, acento, simbolo, lente extra, emoji, estrela ou outro caractere ao lado da palavra. O resultado deve ler apenas "HEXA".
Nao coloque "HEXA" apenas como reflexo na lente; a palavra precisa ser a estrutura do oculos.
Acabamento: fundo totalmente transparente e recortado rente a silhueta, sem borda branca, sem stroke, sem outline e sem halo.
`.trim(),
  },
  {
    id: '07-cartao-vermelho',
    title: 'Cartao Vermelho',
    kind: 'sticker',
    filename: '07-cartao-vermelho',
    transparent: true,
    prompt: `
Analise a imagem anexada.
Guardrails: isole a pessoa em primeiro plano. Preserve todas as caracteristicas fisicas do rosto e do cabelo. Se a referencia tiver oculos, preserve a armacao amarela e preta com precisao de cores. Se a referencia nao tiver oculos, mantenha o rosto sem oculos.
Acao: a pessoa deve estar com expressao seria e imponente, como um arbitro de futebol, com o braco esticado para frente segurando um cartao vermelho brilhante em direcao a camera.
Elementos tematicos: o cartao vermelho deve ser uma placa retangular fisica, solida e totalmente opaca, com preenchimento vermelho vivo uniforme em toda a superficie. O cartao nao pode ser transparente, translúcido, vazado, oco, apenas contorno, vidro, acetato ou com fundo aparecendo através dele. Pode ter um leve brilho neon nas bordas, mas o interior precisa permanecer vermelho preenchido e opaco. A pessoa veste a camiseta padrao do projeto: camiseta de jogo do Brasil lisa, sem marca e sem numero, com gola em V verde, barra das mangas verde e restante da camiseta amarelo. Se a referencia tiver marca, numero, escudo ou outro simbolo na camiseta, remova e substitua por tecido liso amarelo.
Acabamento: contornos nitidos e fundo 100% transparente para uso direto no WhatsApp.
`.trim(),
  },
  {
    id: '08-tristeza-pos-jogo',
    title: 'Tristeza Pos-Jogo',
    kind: 'sticker',
    filename: '08-tristeza-pos-jogo',
    transparent: true,
    prompt: `
Analise a selfie fornecida.
Guardrails: mantenha a identidade facial e o cabelo. Se a referencia tiver oculos com armacao amarela e preta, preserve esses oculos sem alterar suas cores. Se a referencia nao tiver oculos, nao adicione oculos, armacao ou lente.
Acao: mostre a pessoa com expressao de choro exagerada, lagrimas escorrendo, segurando um lencinho branco perto do rosto como se estivesse enxugando as lagrimas apos o jogo. O lencinho deve ser simples, macio e claramente um tecido pequeno, nao um instrumento musical, nao uma corneta e nao uma vuvuzela.
Elementos tematicos: lencinho branco levemente amassado, com um pequeno detalhe verde e amarelo discreto na borda. Rosto com pintura da bandeira do Brasil levemente borrada pelas lagrimas.
Acabamento: cores um pouco mais frias e dessaturadas para tom dramatico. Fundo completamente transparente, sem borda branca, sem stroke, sem outline e sem halo ao redor do desenho.
`.trim(),
  },
  {
    id: '09-a-taca-e-nossa',
    title: 'A Taca e Nossa',
    kind: 'sticker',
    filename: '09-a-taca-e-nossa',
    transparent: true,
    prompt: `
Analise a imagem fornecida.
Guardrails: foque na pessoa em primeiro plano, mantendo fidelidade aos tracos de etnia e formato de rosto. Se a referencia tiver oculos de grau bicolores amarelo e preto, preserve esses oculos originais. Se a referencia nao tiver oculos, mantenha o rosto sem oculos.
Acao: a pessoa esta de olhos fechados, com expressao de gratidao e emocao profunda, beijando carinhosamente uma taca dourada de futebol mundial que segura com as duas maos perto do rosto.
Elementos tematicos: taca dourada muito detalhada e brilhante. Chuva de papel picado dourado caindo sobre a pessoa.
Acabamento: iluminacao dourada e calorosa, estilo golden hour. Remocao completa do cenario para garantir fundo totalmente transparente com canal alfa.
`.trim(),
  },
  {
    id: '10-hexa',
    title: 'Hexa',
    kind: 'sticker',
    filename: '10-hexa',
    transparent: true,
    prompt: `
Analise a imagem fornecida.
Guardrails: preserve a pessoa ou grupo existente na referencia, sem adicionar novas pessoas. Mantenha identidade facial, cabelo, etnia, acessorios e camiseta de jogo do Brasil.
Acao: mostre a pessoa em comemoracao extrema de titulo, pulando ou levantando os bracos com alegria, expressao euforica, energia de campeao.
Elementos tematicos: confetes verdes e amarelos, raios de movimento e explosao de torcida.
Acessorios: nao adicione oculos tematico, oculos de sol, oculos com texto "HEXA" ou qualquer armacao nova nesta figurinha. Preserve somente oculos reais ja presentes na referencia; se a pessoa nao usa oculos na referencia, mantenha o rosto sem oculos.
Texto obrigatorio: a figurinha deve ter a palavra "HEXAAAAA" uma unica vez, em letras grandes, legiveis, animadas, com movimento, estilo grito de comemoracao. Use somente o texto integrado na arte, preferencialmente na parte inferior junto ao personagem. Nao crie faixa, banner ou segunda repeticao no topo.
Acabamento: fundo 100% transparente, canal alfa real, sem cenario externo.
`.trim(),
  },
  {
    id: '11-goooooool',
    title: 'GOOOOOOOL',
    kind: 'sticker',
    filename: '11-goooooool',
    transparent: true,
    prompt: `
Analise a imagem fornecida.
Guardrails: preserve a pessoa ou grupo existente na referencia, sem adicionar novas pessoas. Mantenha identidade facial, cabelo, etnia, acessorios e camiseta de jogo do Brasil. Preserve exatamente o cabelo da referencia: cor, raiz, comprimento, volume, textura, cachos/ondas/liso, linha do cabelo, laterais, topo da cabeca e fios soltos. Nao pinte, nao altere a cor, nao simplifique, nao alise, nao aumente volume e nao mude o penteado.
Acao: mostre a pessoa gritando gol com energia maxima, boca aberta, olhos fechados ou arregalados, punhos cerrados, pose de explosao de alegria.
Elementos tematicos: confetes verdes e amarelos, linhas de velocidade e aura vibrante de estadio.
Texto obrigatorio: a figurinha deve ter "GOOOOOOOL" uma unica vez, em letras grandes, legiveis, animadas, esticadas e vibrando como narracao de futebol. Use somente o texto integrado na arte, preferencialmente na camada visual inferior/atrás ou junto ao personagem. Nao crie faixa, banner ou segunda repeticao no topo.
Enquadramento obrigatorio: mantenha cabeca, cabelo inteiro, laterais do cabelo, orelhas, ombros, bracos, maos e texto "GOOOOOOOL" 100% dentro do canvas. O texto deve ficar na parte inferior e nunca empurrar a cabeca para fora do quadro. Deixe margem transparente visivel acima do cabelo e nas laterais; se necessario, reduza a escala do personagem e da explosao de torcida para nao cortar cabelo, topo da cabeca ou confetes principais.
Acabamento: fundo 100% transparente, canal alfa real, sem cenario externo, sem borda branca, sem stroke, sem outline e sem halo.
`.trim(),
  },
];

function buildMainCardPrompt(params = {}) {
  const participantName = cleanParam(params.participantName, 'Participante');
  const country = cleanParam(params.country, 'Brasil');
  const position = cleanParam(params.position, 'Craque da torcida');
  const personality = cleanParam(params.personality, 'autentico, seguro e carismatico');
  const extraDetails = cleanParam(params.extraDetails, '');

  return `

Analyze the provided image and create a cutout image of the real participant or group to be used in a programmatic sticker composition.

Create an ultra-realistic, editorial-quality sports photograph featuring me.

Use the face or faces exactly as shown in the reference image. Preserve all facial features, skin tone, facial structure, hairstyle, beard, proportions, and identity with 100% accuracy. Do not alter, beautify, stylize, age, or modify their appearance.


Number of people: recognize and preserve all real people clearly visible in the foreground, with a maximum limit of three people. If there is one person, generate exactly one person. If there are two people, generate exactly two people. If there are three people, generate exactly three people. If there are more than three people, use only the three most prominent people in the foreground and ignore the rest. Do not create new people, do not duplicate an existing person, do not add extras, do not turn one person into two, and do not invent children/adults/characters that are not in the original photo.

Format and purpose: isolated person or group in PNG with true alpha channel, vertical aspect ratio, medium shot, showing from the shirt up: head, shoulders, chest, upper part of the shirt, and arms when fitting naturally. Do not generate a full body, legs, knees, or shoes. The pose must be a heroic football sticker pose, ready to be applied over a background and a frame via composition with Sharp.

Mandatory framing: use a medium sports portrait shot, cropping below the chest or at most at the waist, with the shirt clearly visible. The person or group must occupy the center of the cutout without looking distant. For a group of two or three people, arrange the people side by side, all fully within the medium shot, without one person covering another's face.

Mandatory participant pose: when there is a single person, the body must be almost facing the camera, with a slight natural diagonal rotation. The person's right shoulder must project subtly forward towards the camera, while the left shoulder recedes slightly. The arms must be firmly crossed over the chest, conveying confidence, assurance, and readiness. The right hand must be clearly visible, resting firmly on the left arm or bicep. The left arm must be folded and tucked under the right arm, with the left hand hidden. The head must be straight and aligned with the body, with the face turned directly forward and direct eye contact with the camera. Preserve the person's natural expression from the reference, especially the mouth, teeth, lips, cheeks, eyes, and expression lines. Do not alter the mouth, teeth, lips, cheeks, or eyes to make the person look happier, friendlier, or more posed. The shoulders must be relaxed but structured to support the crossed-arm pose, without tension in the neck. When there are two or three real people, use a cohesive team/supporter pose, preferably with crossed arms or a confident posture for each person when suitable; preserve the natural expressions of each person, but never sacrifice facial likeness or the correct number of people to force the pose.

Cutout integrity: within the defined medium shot, do not crop any visible part of the selected person or people. Head, hair, face, neck, shoulders, arms, chest, and shirt must fit entirely within the image area, with enough transparent margin around them for composition on the card. Do not let fingers, elbows, shoulders, the top of the head, or the sides of the arms go outside the canvas.

Maximum priority: the likeness to each real person in the original photo is more important than any beautification, heroic pose, shirt, sports style, or composition. Preserve the individual identity of each face before changing clothing, pose, or lighting. Do not change apparent age, face shape, facial proportions, skin tone, nose, mouth, eyes, eyebrows, dimples, hair, hairline, beard, jaw shape, forehead shape, distance between eyes, or base expression. Do not thin, round, symmetrize, rejuvenate, age, over-makeup, beautify, change apparent gender, or turn the face into another person.

Hair and face: exactly preserve the original hair of each person, including color, roots, length, volume, texture, waviness/curliness/straightness, parting, bangs, receding hairline, loose strands, and overall shape. Do not lighten, darken, straighten, curl, increase volume, change cut, change hairstyle, add artificial shine, or turn the hair into a stylized version. Also preserve natural facial marks, real skin texture, expression lines, subtle pores, natural asymmetries, and characteristics that aid in recognition.

Mandatory facial likeness: each face must remain recognizable when compared side-by-side with the original photo. Copy the distinctive features of each person: eye shape, nose, mouth, lips, teeth when visible, cheeks, dimples, chin, eyebrows, beard/mustache, hairline, hair texture, and hair length. Avoid generic model faces, stock photo faces, plastic skin, waxy skin, overly smooth skin, beauty filters, standardized expressions, eyes larger than the originals, or any simplification that reduces likeness.

Identity guardrails: faithfully preserve facial likeness, ethnicity, face shape, hair, beard, base expression, and recognizable props from the original photo for each selected person. Existing accessories must maintain their style, material, color, shape, size, and position with maximum fidelity: real earrings, rings, bracelets, watches, necklaces, piercings, hair clips, caps, hats, and glasses must not be redrawn in another style, swapped for generic versions, removed, or recolored. Do not add accessories that do not exist in the original photo. If a person does not wear glasses in the original photo, do not draw glasses on that person. If the eyes, eyebrows, and sides of the face are clear in the reference, keep the face clear: no frames, no lenses, no temples, no glasses shadow, no lens reflection, and no visual mark that looks like glasses. If a person does not wear a cap, hat, earrings, necklace, watch, bracelet, or any other accessory in the original photo, do not invent these items.

Real glasses on the card: if the person wears glasses in the original photo, preserve the glasses as an identity element with maximum priority, even if the clothes are changed to a Brazil shirt. Exactly copy the frame shape, thickness, lens proportions, nose bridge, temples, lens transparency, position on the face, and especially the actual color map of the frame. If the frame is two-tone, asymmetrical, or has parts with different colors, keep each part in the correct color: upper rim, lower rim, left side, right side, bridge, temples, inner face, and outer face. Do not apply the colors of the shirt, the crowd, or Brazil to the glasses. Do not turn a two-tone frame into a single color, do not swap black for green/yellow, do not eliminate dark details, do not simplify it to generic sports glasses, and do not redraw the model. If there are prescription glasses with a yellow and black frame, exactly preserve the design and colors of the frame, including which regions are yellow and which regions are black.

Non-existent glasses on the card: if the original photo does not show real glasses clearly resting on the person's face, it is forbidden to create glasses on the card. Do not add prescription glasses, sunglasses, sports glasses, transparent frames, colored frames, side temples, bridge over the nose, lens, lens reflection, lens shadow, or any accessory around the eyes. Never use glasses as an aesthetic, sports, fan, or sticker element when they do not exist in the reference.

Mandatory clothing: each selected person must appear wearing exactly the project's standard shirt: a plain Brazil match shirt, with no brand and no number, with a green V-neck, green sleeve cuffs, and the rest of the shirt yellow. The collar must clearly be a V-neck, not a crew neck. The sleeves must have the green cuff clearly visible. The fabric can have a realistic sports texture, but without any drawing, number, letter, shield, star, logo, sponsor, or symbol.

Forbidden brands and numbers on the shirt: do not use official shields, trademarks, real logos, sponsors, manufacturer symbols, emblems, sports brands, numbers, letters, or any graphic that looks like a logo. It is forbidden to draw Nike, swoosh, check mark, comma, adidas, Puma, CBF, shield, star, coat of arms, player number, or any similar brand. The shirt must be plain/generic, recognizable only by the yellow body, green V-neck, and green cuffs on the sleeves.

Final accessories checklist: before finalizing the card, compare the eye region with the original photo. If the person does not wear glasses in the reference, the final image must also be without glasses, without a frame, without lenses, and without temples. If the person wears real glasses, they must remain the same model and have the same color regions as the reference. Changing the shirt does not authorize changing, recoloring, simplifying, sportifying, adding, or redrawing the glasses. If any part of the original frame is black, dark, transparent, yellow, green, matte, shiny, or two-tone, keep that part exactly like that.

Direction parameters:

Participant name for identity: ${participantName}

Shirt number: none; do not render a number on the shirt

Position/persona: ${position}

Country/crowd: ${country}

Visual personality: ${personality}

Extra details: ${extraDetails || 'none'}

Art direction: photorealistic, ultra-realistic, and photographic, like a real professional camera capture in a studio for a sports editorial, with natural skin texture, subtle pores, real small imperfections, photographic hair, and real shirt fabric. The result must look like a photograph of a real person, not an AI rendering. Do not use a plastic appearance, CGI, 3D doll, wax skin, airbrushed skin, heavy beauty retouching, generic influencer face, cartoon, stylized 3D, caricature, digital painting, or illustration.

Anatomy: if hands appear, each human hand must have exactly five fingers in total, with no sixth finger, no duplicated fingers, no fused fingers, and no deformities.

Do not include a background, scenery, frame, logos, brands, loose text, written name, drop shadow, card objects, or invented accessories. Do not include a brand, number, letter, text, shield, star, symbol, or graphic on the shirt. The background must be 100% transparent with a true alpha channel. Do not draw a checkered pattern, plaid, gray/white grid, or any visual simulation of transparency.
`.trim();
}

function cleanParam(value, fallback) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function getImageSpecSummaries() {
  return IMAGE_SPECS.map((spec) => ({
    id: spec.id,
    title: spec.title,
    kind: spec.kind,
    filename: spec.filename,
    transparent: spec.transparent,
  }));
}

function buildPromptForSpec(spec, params) {
  const prompt = spec.buildPrompt ? spec.buildPrompt(params) : spec.prompt;
  const shirtPatternRule = 'Camiseta obrigatoria: em todas as figurinhas secundarias, a pessoa deve usar exatamente a camiseta padrao do projeto: camiseta de jogo do Brasil lisa, sem marca e sem numero, com gola em V verde, barra das mangas verde e restante da camiseta amarelo. A gola deve ser V, nao redonda. Nao renderize numero, letra, escudo, estrela, logo, patrocinador, Nike, swoosh, adidas, Puma, CBF, marca, simbolo ou qualquer grafico na camiseta. Se a referencia trouxer numero, marca, escudo ou outro simbolo na camiseta, remova e substitua por tecido amarelo liso.';

  if (spec.kind !== 'sticker') {
    return prompt;
  }

  return `
Analise a imagem fornecida como referencia principal. Ela vem da primeira etapa da geracao e deve mostrar a pessoa usando camiseta de jogo do Brasil.

Estilo base obrigatorio para todas as figurinhas secundarias: use exatamente a mesma linguagem visual de "O Grito de Gol" e "O Sufoco dos Penaltis": caricatura 3D expressiva tipo Pixar, emocional, com formas arredondadas, olhos expressivos quando fizer sentido, pele e cabelo estilizados, cores fortes, contornos internos limpos e personagem isolado. Esta direcao prevalece sobre qualquer estilo especifico citado abaixo.

Regra global de borda: nao crie borda automatica ao redor da pessoa, nao crie stroke branco, outline colorido, halo, brilho externo, recorte adesivado, margem branca grossa, sombra projetada ou qualquer contorno externo envolvendo a silhueta. O personagem deve terminar diretamente no canal alfa transparente, sem moldura ou borda visual. Se algum prompt especifico mencionar "figurinha", interprete apenas como PNG transparente para WhatsApp, nao como adesivo com borda.

Guardrails globais: preserve a identidade facial, etnia, formato do rosto, proporcoes faciais, cabelo, barba e aderecos reconheciveis da referencia antes de aplicar qualquer expressao ou gesto. Nao mude idade aparente, nariz, boca, olhos, sobrancelhas, linha do cabelo, tom de pele ou caracteristicas unicas. Acessorios existentes devem manter estilo, material, cor, formato, tamanho e posicao com maxima fidelidade; nao redesenhe brincos, pulseiras, relogios, colares, piercings, bones, chapeus ou oculos reais em outro estilo. Nao adicione acessorios que nao existam na referencia, exceto quando a direcao especifica da figurinha pedir explicitamente esse acessorio tematico. Se a pessoa nao usa oculos na referencia, nao invente oculos, salvo na figurinha "O Hexa Vem", onde o prompt exige o oculos em formato de HEXA. Mantenha a camiseta padrao do projeto sempre visivel. Se houver oculos de grau amarelos e pretos na referencia, preserve a paleta e formato, exceto quando a direcao especifica pedir substituicao. Nao adicione novas pessoas, rostos, corpos, personagens humanos, mascotes ou figurantes. Use somente a pessoa ou grupo que ja existe na referencia.

Regra de oculos: qualquer mencao a preservar oculos nos prompts especificos e estritamente condicional a referencia mostrar oculos reais no rosto. Se a referencia nao mostrar oculos claramente, assuma que a pessoa nao usa oculos, ignore qualquer preservacao de oculos e mantenha rosto, olhos e sobrancelhas sem armacao ou lentes. A unica excecao para criar oculos novos e a figurinha "O Hexa Vem".

${shirtPatternRule}

Anatomia global das maos: sempre que as maos aparecerem, a mao esquerda e a mao direita devem ter exatamente cinco dedos no total cada uma, nunca seis; sem dedos extras, sem dedos duplicados, sem dedos fundidos, sem dedos repetidos e sem palmas deformadas. Se houver gesto com dedos destacados, mantenha os dedos restantes recolhidos naturalmente ou parcialmente escondidos atras da palma, sem inventar dedos adicionais.

Consistencia obrigatoria: nao mude para fotorrealismo, vetor flat, anime, 2D cartoon, pintura, render realista ou qualquer outro estilo. Todas as secundarias devem parecer parte do mesmo pacote visual.

Enquadramento obrigatorio global: mantenha a figurinha inteira dentro do canvas com margem transparente ao redor em todos os lados. Cabeça, cabelo completo, testa, orelhas, barba, pescoço, ombros, braços, mãos, dedos, camiseta, acessórios existentes da pessoa, acessórios temáticos pedidos no prompt, chapéu, boné, coroa, óculos temático, objetos, cartões, lenço, taça, confetes importantes e textos obrigatórios devem aparecer 100% dentro do canvas. Não corte, não encoste e não deixe sair pela borda superior, inferior ou laterais.

Regra de escala global: se qualquer parte da pessoa, do cabelo, de um acessório real, de um acessório temático ou de um texto obrigatório estiver perto de ser cortada, reduza a escala de toda a composição/personagem até caber completamente. É obrigatório preferir um personagem menor com margem transparente a uma imagem grande cortada. Antes de finalizar, faça uma checagem visual de bordas: nada relevante pode tocar ou ultrapassar as bordas do canvas.

Direcao especifica para "${spec.title}":
${prompt}
`.trim();
}

module.exports = {
  MAIN_IMAGE_ID,
  IMAGE_SPECS,
  buildPromptForSpec,
  getImageSpecSummaries,
};
