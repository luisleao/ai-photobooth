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
Pose: os dois bracos devem estar estendidos para cima e para fora, um para cada lado, apontando para uma armação retangular de gol acima/ao redor da pessoa. As maos devem estar fechadas como punhos, com somente o dedo indicador de cada mao estendido: o indicador esquerdo aponta para um lado da trave, o indicador direito aponta para o outro lado da trave. Nao fazer sinal de quadrado com as maos. Nao juntar as maos na frente do peito.
Anatomia das maos: cada mao deve aparecer como punho fechado com apenas um indicador visivel e estendido. Os outros quatro dedos de cada mao devem ficar recolhidos no punho, sem aparecerem como dedos soltos. A mao esquerda deve ter exatamente cinco dedos totais. A mao direita deve ter exatamente cinco dedos totais. Nao crie sexto dedo, dedo extra, dedo duplicado, dedo solto no meio da composicao, dedo vertical cruzando a area do gol, dedos fundidos, dedos repetidos ou palmas deformadas.
Elementos tematicos: adicione uma armação simples de gol em vermelho ou laranja, composta somente por dois postes verticais e um travessao superior, sem rede, sem malha e sem grade interna. Dentro da area do gol, adicione um balaozinho arredondado com o texto "VAR" em branco. O balao deve ficar dentro da armação do gol e nao pode cobrir o rosto da pessoa.
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
Acao e elementos tematicos: coloque uma coroa de rei da torcida sobre a cabeca da pessoa existente, ou sobre cada pessoa existente em primeiro plano quando houver grupo real. A coroa deve ser grande, divertida, verde e amarela, com detalhes dourados e pequenas estrelas, sem parecer uma taca ou chapeu gigante.
Enquadramento obrigatorio da coroa: a coroa e parte essencial da figurinha e deve aparecer 100% visivel dentro do canvas. Deixe uma margem transparente ampla acima da coroa e nas laterais. Nao corte a ponta superior, joias, estrelas, bordas laterais ou qualquer detalhe da coroa. Se necessario, reduza fortemente o tamanho da pessoa e afaste o enquadramento para caber cabeca, coroa inteira, ombros, bracos e maos. A coroa deve ficar sobre a cabeca, centralizada, sem sair para fora do quadro, sem tocar nas bordas do canvas e com espaco transparente visivel acima do ponto mais alto.
Regra de escala da coroa: antes de finalizar, verifique o topo da coroa, pontas, estrelas e esferas. Se qualquer parte da coroa ficar a menos de 8% da borda superior ou lateral, diminua a escala de todo o personagem ate sobrar margem transparente. E melhor a pessoa ficar menor no canvas do que cortar qualquer parte da coroa.
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
  const personality = cleanParam(params.personality, 'confiante, alegre e carismatico');
  const extraDetails = cleanParam(params.extraDetails, '');

  return `
Analise a imagem fornecida e crie uma imagem recortada do participante ou grupo real para ser usada em uma composicao programatica de figurinha.

Quantidade de pessoas: reconheca e preserve todas as pessoas reais claramente visiveis em primeiro plano, com limite maximo de tres pessoas. Se houver uma pessoa, gere exatamente uma pessoa. Se houver duas pessoas, gere exatamente duas pessoas. Se houver tres pessoas, gere exatamente tres pessoas. Se houver mais de tres pessoas, use somente as tres pessoas mais proeminentes em primeiro plano e ignore o restante. Nao crie pessoas novas, nao duplique uma pessoa existente, nao adicione figurantes, nao transforme uma pessoa em duas e nao invente criancas/adultos/personagens que nao estejam na foto original.

Formato e finalidade: pessoa ou grupo isolado em PNG com canal alfa real, proporcao vertical, em plano medio, mostrando da camiseta para cima: cabeca, ombros, peito, parte superior da camiseta e bracos quando couber naturalmente. Nao gere corpo inteiro, pernas, joelhos ou sapatos. A pose deve ser heroica de figurinha de futebol, pronta para ser aplicada sobre um fundo e uma moldura via composicao com Sharp.

Enquadramento obrigatorio: use plano medio de retrato esportivo, cortando abaixo do peito ou no maximo ate a cintura, com a camiseta bem visivel. A pessoa ou grupo deve ocupar o centro do recorte sem parecer distante. Para grupo de duas ou tres pessoas, organize as pessoas lado a lado, todas inteiras dentro do plano medio, sem uma pessoa cobrir o rosto da outra.

Pose obrigatoria do participante: quando houver uma unica pessoa, o corpo deve estar quase de frente para a camera, com leve rotacao diagonal natural. O ombro direito da pessoa deve ficar sutilmente mais projetado para frente em direcao a camera, enquanto o ombro esquerdo recua um pouco. Os bracos devem estar firmemente cruzados sobre o peito, transmitindo confianca, seguranca e prontidao. A mao direita deve estar claramente visivel, repousando de forma firme sobre o braco ou biceps esquerdo. O braco esquerdo deve estar dobrado e encaixado por baixo do braco direito, com a mao esquerda oculta. A cabeca deve ficar reta e alinhada com o corpo, com o rosto virado diretamente para frente e contato visual direto com a camera. Preserve a expressao natural da pessoa na referencia, especialmente boca, dentes, bochechas, olhos e linhas de expressao. Nao force sorriso, nao crie sorriso artificial de banco de imagem, nao exagere a boca e nao altere o formato original dos dentes, labios, bochechas ou olhos para tornar a pessoa mais alegre. Se a pessoa ja estiver sorrindo na foto original, preserve esse sorriso de forma fiel e reconhecivel; se nao estiver sorrindo, mantenha uma expressao confiante e natural sem inventar sorriso. Os ombros devem ficar relaxados, mas estruturados para dar suporte a pose dos bracos cruzados, sem tensao no pescoco. Quando houver duas ou tres pessoas reais, use uma pose coesa de equipe/torcida, preferencialmente com bracos cruzados ou postura confiante para cada pessoa quando couber; preserve as expressoes naturais de cada pessoa, mas nunca sacrifique a semelhanca facial ou o numero correto de pessoas para forcar a pose.

Integridade do recorte: dentro do plano medio definido, nao corte nenhuma parte visivel da pessoa ou das pessoas selecionadas. Cabeca, cabelo, rosto, pescoco, ombros, bracos, peito e camiseta devem ficar inteiros dentro da area da imagem, com margem transparente suficiente ao redor para composicao no card. Nao deixe dedos, cotovelos, ombros, topo da cabeca ou laterais dos bracos sairem para fora do canvas.

Prioridade maxima: a semelhanca com cada pessoa real da foto original e mais importante que qualquer embelezamento, pose heroica, camiseta, estilo esportivo ou composicao. Preserve a identidade individual de cada rosto antes de alterar roupa, pose ou iluminacao. Nao mude idade aparente, formato do rosto, proporcoes faciais, tom de pele, nariz, boca, olhos, sobrancelhas, sorriso, covinhas, cabelo, linha do cabelo, barba, formato da mandibula, formato da testa, distancia entre os olhos ou expressao-base. Nao afine, arredonde, simetrize, rejuveneca, envelheca, maquie excessivamente, embeleze, troque genero aparente ou transforme o rosto em outra pessoa.

Cabelo e face: preserve exatamente o cabelo original de cada pessoa, incluindo cor, raiz, comprimento, volume, textura, ondulacao/cacheado/liso, reparticao, franja, entradas, fios soltos e formato geral. Nao clareie, escureca, alise, cacheie, aumente volume, mude corte, mude penteado, adicione brilho artificial ou transforme o cabelo em versao estilizada. Preserve tambem marcas naturais da face, textura real de pele, linhas de expressao, poros sutis, assimetrias naturais e caracteristicas que ajudam no reconhecimento.

Semelhanca facial obrigatoria: cada rosto deve continuar reconhecivel quando comparado lado a lado com a foto original. Copie os tracos distintivos de cada pessoa: formato dos olhos, nariz, boca, sorriso, bochechas, covinhas, queixo, sobrancelhas, barba/bigode, linha do cabelo, textura e comprimento do cabelo. Evite rosto generico de modelo, rosto de banco de imagem, pele plastificada, pele encerada, pele excessivamente lisa, filtro de beleza, sorriso padronizado, olhos maiores que os originais ou qualquer simplificacao que reduza a semelhanca.

Guardrails de identidade: preserve fielmente semelhanca facial, etnia, formato do rosto, cabelo, barba, expressao-base e aderecos reconheciveis da foto original para cada pessoa selecionada. Acessorios existentes devem manter estilo, material, cor, formato, tamanho e posicao com maxima fidelidade: brincos, aneis, pulseiras, relogios, colares, piercings, presilhas, bone, chapeu e oculos reais nao podem ser redesenhados em outro estilo, trocados por versoes genericas, removidos ou recoloridos. Nao adicione acessorios que nao existam na foto original. Se uma pessoa nao usa oculos na foto original, nao desenhe oculos nessa pessoa. Se uma pessoa nao usa bone, chapeu, brincos, colar, relogio, pulseira ou qualquer outro acessorio na foto original, nao invente esses itens.

Oculos reais no cartao: se a pessoa usa oculos na foto original, preserve os oculos como um elemento de identidade, com maxima prioridade. Copie exatamente o formato da armacao, espessura, proporcao das lentes, ponte nasal, hastes, transparencias das lentes, posicao no rosto e principalmente o mapa de cores real da armacao. Se a armacao for bicolor, assimetrica ou tiver partes com cores diferentes, mantenha cada parte na cor correta: aro superior, aro inferior, lado esquerdo, lado direito, ponte, hastes, face interna e face externa. Nao transforme uma armacao bicolor em uma unica cor, nao troque preto por verde/amarelo, nao elimine detalhes escuros, nao simplifique para um oculos esportivo generico e nao redesenhe o modelo. Se houver oculos de grau com armacao amarela e preta, preserve exatamente o design e as cores da armacao, incluindo quais regioes sao amarelas e quais regioes sao pretas.

Roupa obrigatoria: cada pessoa selecionada deve aparecer vestindo exatamente a camiseta padrao do projeto: camiseta de jogo do Brasil lisa, sem marca e sem numero, com gola em V verde, barra das mangas verde e restante da camiseta amarelo. A gola deve ser claramente em V, nao gola redonda. As mangas devem ter a barra verde bem visivel. O tecido pode ter textura esportiva realista, mas sem qualquer desenho, numero, letra, escudo, estrela, logo, patrocinador ou simbolo.

Marcas e numeros proibidos na camiseta: nao use escudos oficiais, marcas registradas, logos reais, patrocinadores, simbolos de fabricante, emblemas, marcas esportivas, numeros, letras ou qualquer grafico que pareca logotipo. E proibido desenhar Nike, swoosh, check mark, virgula, adidas, Puma, CBF, escudo, estrela, brasao, numero de jogador ou qualquer marca parecida. A camisa deve ser lisa/generica, reconhecivel apenas pelo amarelo do corpo, gola V verde e barra verde nas mangas.

Parametros de direcao:
- Nome do participante para identidade: ${participantName}
- Numero da camisa: nenhum; nao renderizar numero na camiseta
- Posicao/persona: ${position}
- Pais/torcida: ${country}
- Personalidade visual: ${personality}
- Detalhes extras: ${extraDetails || 'nenhum'}

Direcao de arte: foto realista, ultra-realista e fotografica, como uma captura real de camera profissional em estudio para editorial esportivo, com textura natural de pele, poros sutis, pequenas imperfeicoes reais, cabelo fotografico e tecido real da camiseta. O resultado deve parecer uma fotografia de uma pessoa real, nao uma renderizacao de IA. Nao use aparencia plastica, CGI, boneco 3D, pele de cera, pele airbrushed, retoque de beleza pesado, rosto de influenciador generico, cartoon, 3D estilizado, caricatura, pintura digital ou ilustracao.

Anatomia: se as maos aparecerem, cada mao humana deve ter exatamente cinco dedos no total, sem sexto dedo, sem dedos duplicados, sem dedos fundidos e sem deformacoes.

Nao inclua fundo, cenario, moldura, logos, marcas, texto solto, nome escrito, sombra projetada, objetos de card ou acessorios inventados. Nao inclua marca, numero, letra, texto, escudo, estrela, simbolo ou grafico na camiseta. O fundo deve ser 100% transparente com alfa real. Nao desenhe padrao quadriculado, xadrez, grid cinza/branco ou qualquer simulacao visual de transparencia.
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
