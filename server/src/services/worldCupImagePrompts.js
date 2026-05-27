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
Elementos tematicos: vista a pessoa com a camisa amarela da selecao ou coloque uma faixa de suor escrita "BRASIL" na cabeca.
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
Acao: modifique a expressao para indignacao e ceticismo, com as sobrancelhas franzidas. Adicione os bracos a frente do peito fazendo o sinal de "quadrado" do VAR usando apenas os polegares e indicadores das duas maos. As maos nao devem ficar coladas; deixe um espaco vazio claro no centro do retangulo.
Anatomia das maos: a mao esquerda e a mao direita devem ter exatamente cinco dedos no total cada uma, nunca seis. No gesto do VAR, destaque somente o polegar e o indicador de cada mao formando os cantos do retangulo; os outros tres dedos de cada mao devem ficar recolhidos de modo natural ou parcialmente escondidos atras da palma. A mao esquerda deve ter exatamente cinco dedos totais. A mao direita deve ter exatamente cinco dedos totais. Nao crie dedo extra em nenhuma das maos, nao crie dedo no meio do quadrado, nao crie dedo vertical cruzando o centro, nao crie dedos fundidos, duplicados, repetidos ou palmas deformadas. O centro do gesto deve ficar limpo e vazio.
Elementos tematicos: adicione um bone de torcedor verde e amarelo na cabeca.
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
Enquadramento: a pessoa inteira e a coroa devem aparecer completamente dentro da imagem, com margem transparente ao redor. Nao corte cabeca, coroa, bracos, maos, ombros ou qualquer parte importante da silhueta.
Acabamento: remova totalmente o cenario original e exporte com fundo transparente. Nao adicione borda, stroke, outline, halo, brilho externo ou contorno branco ao redor da silhueta.
`.trim(),
  },
  {
    id: '06-hexa-vem',
    title: 'O Hexa Vem',
    kind: 'sticker',
    filename: '06-hexa-vem',
    transparent: true,
    prompt: `
Analise a imagem fornecida e foque exclusivamente nos rostos em primeiro plano.
Guardrails: preserve a identidade, o corte de cabelo e as proporcoes do rosto perfeitamente.
Acao importante: substitua temporariamente os oculos de grau originais da foto pelo elemento tematico abaixo, ajustando-o perfeitamente ao rosto.
Elementos tematicos: adicione um oculos tipografico frontal, reto e simetrico, estilo oculos de festa, em que a propria palavra "HEXA" forma a estrutura do oculos. O texto deve ser exatamente "HEXA", com quatro letras e somente quatro letras: H, E, X, A. As letras devem ser grandes, em bloco 3D arredondado, com frente verde e amarela, contorno verde escuro fino e sem lentes transparentes. O X deve funcionar como a ponte central sobre o nariz.
Padrao visual obrigatorio do oculos: uma unica palavra "HEXA" horizontal, centralizada sobre os olhos, sem inclinacao forte, sem faixa, sem banner, sem reflexo de texto, sem segunda camada de texto, sem palavra repetida e sem qualquer elemento lateral que pareca uma letra ou numero. Nao desenhe hastes laterais visiveis, blocos, retangulos ou extensoes depois da letra A ou antes da letra H.
Texto proibido: nao escreva "HEXA1", "HEXA!", "HEXAA", "HEXA VEM", "O HEXA", "HEXA6", "HEXA0" ou qualquer variacao. Nao adicione numeral 1, ponto de exclamacao, acento, simbolo, lente extra, emoji, estrela ou outro caractere ao lado da palavra. O resultado deve ler apenas "HEXA".
Nao coloque "HEXA" apenas como reflexo na lente; a palavra precisa ser a estrutura do oculos.
Acabamento: fundo totalmente transparente e recortado rente a silhueta.
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
Elementos tematicos: o cartao vermelho deve ser uma placa retangular fisica, solida e totalmente opaca, com preenchimento vermelho vivo uniforme em toda a superficie. O cartao nao pode ser transparente, translúcido, vazado, oco, apenas contorno, vidro, acetato ou com fundo aparecendo através dele. Pode ter um leve brilho neon nas bordas, mas o interior precisa permanecer vermelho preenchido e opaco. A pessoa veste uma camiseta de jogo do Brasil generica, amarela com detalhes verdes, sem nenhuma marca, sem Nike, sem swoosh, sem escudo oficial, sem patrocinador, sem texto de marca e sem qualquer logo visivel. Se a referencia tiver marca na camiseta, remova e substitua por tecido liso.
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
Guardrails: preserve a pessoa ou grupo existente na referencia, sem adicionar novas pessoas. Mantenha identidade facial, cabelo, etnia, acessorios e camiseta de jogo do Brasil.
Acao: mostre a pessoa gritando gol com energia maxima, boca aberta, olhos fechados ou arregalados, punhos cerrados, pose de explosao de alegria.
Elementos tematicos: confetes verdes e amarelos, linhas de velocidade e aura vibrante de estadio.
Texto obrigatorio: a figurinha deve ter "GOOOOOOOL" uma unica vez, em letras grandes, legiveis, animadas, esticadas e vibrando como narracao de futebol. Use somente o texto integrado na arte, preferencialmente na camada visual inferior/atrás ou junto ao personagem. Nao crie faixa, banner ou segunda repeticao no topo.
Acabamento: fundo 100% transparente, canal alfa real, sem cenario externo.
`.trim(),
  },
];

function buildMainCardPrompt(params = {}) {
  const participantName = cleanParam(params.participantName, 'Participante');
  const country = cleanParam(params.country, 'Brasil');
  const jerseyNumber = cleanParam(params.jerseyNumber, '');
  const position = cleanParam(params.position, 'Craque da torcida');
  const personality = cleanParam(params.personality, 'confiante, alegre e carismatico');
  const extraDetails = cleanParam(params.extraDetails, '');
  const jerseyInstruction = jerseyNumber
    ? `A camiseta deve ter o numero ${jerseyNumber} exatamente uma unica vez, grande e centralizado no peito. Nao desenhe um segundo numero ${jerseyNumber}, nao desenhe numero pequeno no ombro ou no lado direito do peito, nao repita o numero em nenhuma outra area da camiseta e nao coloque outros numeros.`
    : 'Nao inclua nenhum numero na camiseta. A camiseta deve permanecer lisa/generica, sem numero no peito, ombro, manga, costas ou qualquer outra area.';
  const jerseyParameter = jerseyNumber || 'nenhum; nao renderizar numero na camiseta';

  return `
Analise a imagem fornecida e crie uma imagem recortada do participante para ser usada em uma composicao programatica de figurinha.

Formato e finalidade: pessoa isolada em PNG com canal alfa real, proporcao vertical, em plano medio, mostrando da camiseta para cima: cabeca, ombros, peito, parte superior da camiseta e bracos quando couber naturalmente. Nao gere corpo inteiro, pernas, joelhos ou sapatos. A pose deve ser heroica de figurinha de futebol, pronta para ser aplicada sobre um fundo e uma moldura via composicao com Sharp.

Enquadramento obrigatorio: use plano medio de retrato esportivo, cortando abaixo do peito ou no maximo ate a cintura, com a camiseta bem visivel. A pessoa deve ocupar o centro do recorte sem parecer distante.

Pose obrigatoria do participante: o corpo deve estar quase de frente para a camera, com leve rotacao diagonal natural. O ombro direito da pessoa deve ficar sutilmente mais projetado para frente em direcao a camera, enquanto o ombro esquerdo recua um pouco. Os bracos devem estar firmemente cruzados sobre o peito, transmitindo confianca, seguranca e prontidao. A mao direita deve estar claramente visivel, repousando de forma firme sobre o braco ou biceps esquerdo. O braco esquerdo deve estar dobrado e encaixado por baixo do braco direito, com a mao esquerda oculta. A cabeca deve ficar reta e alinhada com o corpo, com o rosto virado diretamente para frente, contato visual direto com a camera e um leve sorriso contido. Os ombros devem ficar relaxados, mas estruturados para dar suporte a pose dos bracos cruzados, sem tensao no pescoco.

Integridade do recorte: dentro do plano medio definido, nao corte nenhuma parte visivel da pessoa. Cabeca, cabelo, rosto, pescoco, ombros, bracos cruzados, mao direita visivel, peito e camiseta devem ficar inteiros dentro da area da imagem, com margem transparente suficiente ao redor para composicao no card. Nao deixe dedos, cotovelos, ombros, topo da cabeca ou laterais dos bracos sairem para fora do canvas.

Prioridade maxima: a semelhanca com a pessoa da foto original e mais importante que qualquer embelezamento, pose heroica ou estilo esportivo. Nao mude idade aparente, formato do rosto, proporcoes faciais, tom de pele, nariz, boca, olhos, sobrancelhas, sorriso, covinhas, cabelo, linha do cabelo, barba ou expressao-base. Nao afine, arredonde, simetrize, rejuveneca, envelheca ou transforme o rosto em outra pessoa.

Guardrails de identidade: preserve fielmente semelhanca facial, etnia, formato do rosto, cabelo, barba, expressao-base e aderecos reconheciveis da foto original. Acessorios existentes devem manter estilo, material, cor, formato, tamanho e posicao com maxima fidelidade: brincos, aneis, pulseiras, relogios, colares, piercings, presilhas, bone, chapeu e oculos reais nao podem ser redesenhados em outro estilo, trocados por versoes genericas, removidos ou recoloridos. Nao adicione acessorios que nao existam na foto original. Se a pessoa nao usa oculos na foto original, nao desenhe oculos. Se a pessoa nao usa bone, chapeu, brincos, colar, relogio, pulseira ou qualquer outro acessorio na foto original, nao invente esses itens. Se houver oculos de grau com armacao amarela e preta, preserve exatamente o design e as cores da armacao.

Roupa obrigatoria: a pessoa deve aparecer vestindo uma camiseta de jogo do Brasil generica, preferencialmente amarela com detalhes verdes e acabamento esportivo moderno. ${jerseyInstruction}

Marcas proibidas na camiseta: nao use escudos oficiais, marcas registradas, logos reais, patrocinadores, simbolos de fabricante, emblemas, marcas esportivas ou qualquer grafico que pareca logotipo. E proibido desenhar Nike, swoosh, check mark, virgula, adidas, Puma, CBF, escudo, estrela, brasao ou qualquer marca parecida. A camisa deve ser lisa/generica, reconhecivel apenas pelas cores do Brasil${jerseyNumber ? ` e pelo unico numero ${jerseyNumber}` : ', sem numero e sem logotipo'}.

Parametros de direcao:
- Nome do participante para identidade: ${participantName}
- Numero da camisa: ${jerseyParameter}
- Posicao/persona: ${position}
- Pais/torcida: ${country}
- Personalidade visual: ${personality}
- Detalhes extras: ${extraDetails || 'nenhum'}

Direcao de arte: hiper-realista e fotografica, como uma foto editorial esportiva premium em estudio, pele natural, textura real de tecido, iluminacao profissional, profundidade e nitidez de impressao. A pessoa deve parecer real, nao cartoon, nao 3D estilizado, nao caricatura, nao ilustracao.

Anatomia: se as maos aparecerem, cada mao humana deve ter exatamente cinco dedos no total, sem sexto dedo, sem dedos duplicados, sem dedos fundidos e sem deformacoes.

Nao inclua fundo, cenario, moldura, logos, marcas, texto solto, nome escrito, sombra projetada, objetos de card ou acessorios inventados. Nao inclua marca na roupa${jerseyNumber ? ' e nao repita o numero da camiseta' : ', numero ou qualquer texto na camiseta'}. O fundo deve ser 100% transparente com alfa real. Nao desenhe padrao quadriculado, xadrez, grid cinza/branco ou qualquer simulacao visual de transparencia.
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
  const jerseyNumber = cleanParam(params.jerseyNumber, '');
  const jerseyNumberRule = jerseyNumber
    ? `Numero da camiseta: se a referencia exibir um numero na camiseta, preserve exatamente o mesmo numero em todas as figurinhas secundarias. Para esta geracao, o numero esperado e ${jerseyNumber}; mantenha esse numero visivel, grande e legivel na camiseta sempre que o torso aparecer. Organize pose, maos, objetos e texto para nao cobrir completamente o numero. Nao remova, nao esconda, nao substitua, nao altere, nao duplique e nao mova o numero para ombro, manga ou outra area.`
    : 'Numero da camiseta: o formulario nao definiu numero. Se a referencia nao exibir numero na camiseta, nao invente numero algum nas figurinhas secundarias. A camiseta deve permanecer sem numero, sem texto e sem logotipo. Se por acaso a referencia ja exibir um numero real na camiseta, preserve exatamente esse numero sem duplicar.';

  if (spec.kind !== 'sticker') {
    return prompt;
  }

  return `
Analise a imagem fornecida como referencia principal. Ela vem da primeira etapa da geracao e deve mostrar a pessoa usando camiseta de jogo do Brasil.

Estilo base obrigatorio para todas as figurinhas secundarias: use exatamente a mesma linguagem visual de "O Grito de Gol" e "O Sufoco dos Penaltis": caricatura 3D expressiva tipo Pixar, emocional, com formas arredondadas, olhos expressivos quando fizer sentido, pele e cabelo estilizados, cores fortes, contornos internos limpos e personagem isolado. Esta direcao prevalece sobre qualquer estilo especifico citado abaixo.

Regra global de borda: nao crie borda automatica ao redor da pessoa, nao crie stroke branco, outline colorido, halo, brilho externo, recorte adesivado, margem branca grossa, sombra projetada ou qualquer contorno externo envolvendo a silhueta. O personagem deve terminar diretamente no canal alfa transparente, sem moldura ou borda visual. Se algum prompt especifico mencionar "figurinha", interprete apenas como PNG transparente para WhatsApp, nao como adesivo com borda.

Guardrails globais: preserve a identidade facial, etnia, formato do rosto, proporcoes faciais, cabelo, barba e aderecos reconheciveis da referencia antes de aplicar qualquer expressao ou gesto. Nao mude idade aparente, nariz, boca, olhos, sobrancelhas, linha do cabelo, tom de pele ou caracteristicas unicas. Acessorios existentes devem manter estilo, material, cor, formato, tamanho e posicao com maxima fidelidade; nao redesenhe brincos, pulseiras, relogios, colares, piercings, bones, chapeus ou oculos reais em outro estilo. Nao adicione acessorios que nao existam na referencia, exceto quando a direcao especifica da figurinha pedir explicitamente esse acessorio tematico. Se a pessoa nao usa oculos na referencia, nao invente oculos, salvo na figurinha "O Hexa Vem", onde o prompt exige o oculos em formato de HEXA. Mantenha a camiseta de jogo do Brasil visivel, preferencialmente amarela com detalhes verdes, sempre generica e sem marcas: sem Nike, sem swoosh, sem escudos oficiais, sem patrocinadores, sem textos de marca e sem qualquer logo visivel. Se houver oculos de grau amarelos e pretos na referencia, preserve a paleta e formato, exceto quando a direcao especifica pedir substituicao. Nao adicione novas pessoas, rostos, corpos, personagens humanos, mascotes ou figurantes. Use somente a pessoa ou grupo que ja existe na referencia.

Regra de oculos: qualquer mencao a preservar oculos nos prompts especificos e estritamente condicional a referencia mostrar oculos reais no rosto. Se a referencia nao mostrar oculos claramente, assuma que a pessoa nao usa oculos, ignore qualquer preservacao de oculos e mantenha rosto, olhos e sobrancelhas sem armacao ou lentes. A unica excecao para criar oculos novos e a figurinha "O Hexa Vem".

${jerseyNumberRule}

Anatomia global das maos: sempre que as maos aparecerem, a mao esquerda e a mao direita devem ter exatamente cinco dedos no total cada uma, nunca seis; sem dedos extras, sem dedos duplicados, sem dedos fundidos, sem dedos repetidos e sem palmas deformadas. Se houver gesto com dedos destacados, mantenha os dedos restantes recolhidos naturalmente ou parcialmente escondidos atras da palma, sem inventar dedos adicionais.

Consistencia obrigatoria: nao mude para fotorrealismo, vetor flat, anime, 2D cartoon, pintura, render realista ou qualquer outro estilo. Todas as secundarias devem parecer parte do mesmo pacote visual.

Enquadramento obrigatorio: mantenha a figurinha inteira dentro do canvas com margem transparente ao redor. Nao corte cabeca, chapeu/coroa, bracos, maos, texto ou objetos tematicos.

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
