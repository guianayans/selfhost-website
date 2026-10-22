// Manuais por função (dentro do Guia de cada frente): quem faz cada tarefa e o "kit" com tudo que a
// pessoa precisa para completar o Passo a passo — o que saber, material pronto, dicas e erros comuns.
// As tarefas são referenciadas pelo código de entrega (A1, B2…), o mesmo do Passo a passo e do site.

/** Funções de cada frente (os mesmos ids das vagas do site). `tarefas` = códigos que a função lidera. */
export const FUNCOES = {
  a: [
    { vaga: 'a1', nome: 'Coordenação', icone: '\\faCompass', missao: 'Conduz as reuniões e acompanha se o grupo está no prazo.', tarefas: ['A2', 'A3'] },
    { vaga: 'a2', nome: 'Documentação', icone: '\\faClipboard', missao: 'Registra o projeto no papel: Canvas, ata e o trabalho final.', tarefas: ['A1', 'A4'] },
    { vaga: 'a-dev', nome: 'Dev de apoio', icone: '\\faLaptopCode', missao: 'Mostra o sistema e confirma as informações técnicas.', dev: true },
  ],
  b: [
    { vaga: 'b-po', nome: 'Product Owner', icone: '\\faCrown', missao: 'Decide o que é mais importante no sistema e escreve a lista (backlog).', tarefas: ['B1', 'B3'] },
    { vaga: 'b-sm', nome: 'Scrum Master', icone: '\\faRunning', missao: 'Organiza o quadro de tarefas e puxa as reuniões rápidas.', tarefas: ['B2', 'B4'] },
    { vaga: 'b-dev', nome: 'Dev de apoio', icone: '\\faLaptopCode', missao: 'Mostra o sistema e ajuda a estimar as tarefas.', dev: true },
  ],
  c: [
    { vaga: 'c1', nome: 'Metas', icone: '\\faBullseye', missao: 'Define as metas do hotel e explica os indicadores.', tarefas: ['C1', 'C2'] },
    { vaga: 'c2', nome: 'Painel', icone: '\\faChartBar', missao: 'Monta a planilha com os números, as cores e o gráfico.', tarefas: ['C3'] },
    { vaga: 'c-dev', nome: 'Dev de apoio', icone: '\\faLaptopCode', missao: 'Passa os números da versão de demonstração.', dev: true },
  ],
  d: [
    { vaga: 'd1', nome: 'Relação com a cliente', icone: '\\faHandshake', missao: 'Conversa com a dona do hotel e cuida de quem decide o quê.', tarefas: ['D1', 'D4'] },
    { vaga: 'd2', nome: 'Treinamento', icone: '\\faChalkboardTeacher', missao: 'Faz os manuais e o plano para os funcionários aprenderem o sistema.', tarefas: ['D2', 'D3'] },
    { vaga: 'd-dev', nome: 'Dev de apoio', icone: '\\faLaptopCode', missao: 'Cria os usuários de teste e ajuda nos prints.', dev: true },
  ],
};

/** Quem faz cada tarefa (aparece no Passo a passo). */
export const QUEM = {
  A1: 'Documentação (com a Coordenação)',
  A2: 'Coordenação conduz · Documentação anota',
  A3: 'Coordenação',
  A4: 'Documentação (com a Coordenação)',
  B1: 'Product Owner',
  B2: 'Scrum Master',
  B3: 'PO escolhe · Scrum Master calcula',
  B4: 'Scrum Master',
  C1: 'Metas',
  C2: 'Metas (com o Painel)',
  C3: 'Painel',
  D1: 'Relação com a cliente',
  D2: 'Treinamento',
  D3: 'Treinamento',
  D4: 'Relação com a cliente',
};

/** O que o dev de apoio entrega em cada tarefa da frente. */
export const APOIO_DEV = {
  a: [
    ['A1', 'Explicar o sistema em 5 minutos e conferir "Entregas" e "Equipe" do Canvas.'],
    ['A2', 'Participar do kick-off e explicar o que já está pronto no sistema.'],
    ['A3', 'Avisar se alguma tarefa técnica pode atrasar.'],
    ['A4', 'Revisar os slides que falam do sistema.'],
  ],
  b: [
    ['B1', 'Mostrar a versão de demonstração por 15 minutos e conferir se os 10 itens existem no sistema.'],
    ['B2', 'Entrar no quadro do Trello e mover os próprios cartões.'],
    ['B3', 'Dizer se as horas estimadas fazem sentido.'],
    ['B4', 'Participar das dailies.'],
  ],
  c: [
    ['C1', 'Confirmar que o sistema consegue medir os resultados-chave escolhidos.'],
    ['C2', 'Mostrar a tela Relatórios → "Ocupação, diária média e RevPAR".'],
    ['C3', 'Exportar um relatório em CSV da versão de demonstração (ou confirmar os números de exemplo).'],
  ],
  d: [
    ['D1', 'Passar o link do questionário e ajudar a abrir o arquivo de respostas.'],
    ['D2', 'Criar um usuário de Recepção e um de Governança na demonstração e ajudar nos prints.'],
    ['D3', 'Dizer quanto tempo leva para aprender cada tela.'],
    ['D4', 'Confirmar quem cuida de backup e de criar usuários.'],
  ],
};

// ---------- Kits de cada tarefa ----------
// saber[]: o essencial; material[]: blocos { titulo, lista? , tabela? {colunas, linhas}, texto? };
// dicas[] e erros[] (erros comuns).
export const KITS = {
  // ----- Frente A -----
  A1: {
    saber: [
      'Canvas = o projeto inteiro numa página. Cada bloco responde uma pergunta simples.',
      'Uma frase por bloco basta. Se precisar de parágrafo, a ideia ainda não está clara.',
    ],
    material: [
      {
        titulo: 'Informações do projeto para usar nos blocos',
        tabela: {
          colunas: ['Bloco', 'Informação que ajuda'],
          linhas: [
            ['Objetivo', 'Um sistema para o hotel controlar quartos, reservas e caixa sem erros e sem depender de internet.'],
            ['Benefícios', 'Fim do overbooking, caixa que bate, relatórios para a dona decidir preço.'],
            ['Interessados', 'Dona do hotel, recepcionistas, governança, gerência, hóspedes, contador, o grupo e o professor.'],
            ['Entregas', 'O sistema (pronto) + os documentos das 4 frentes + apresentação.'],
            ['Riscos', 'Falta de tempo do grupo, dona demorar a responder, funcionários com dificuldade.'],
            ['Prazo', '4 semanas (ver o cronograma do site).'],
            ['Equipe', '12 pessoas: 4 devs e 4 duplas de gestão.'],
            ['Como medir', 'As metas da Frente C (ex.: check-in em 3 minutos).'],
          ],
        },
      },
    ],
    dicas: ['No Canva, procurem o modelo "Project Model Canvas".', 'Usem a cor da Frente A (azul) no quadro.'],
    erros: ['Objetivo sem verbo ("sistema do hotel"). Comece com um verbo: "Implantar…", "Organizar…".'],
  },
  A2: {
    saber: [
      'O kick-off não é para descobrir o projeto: é para todos saírem sabendo o que fazer.',
      'Toda decisão anotada precisa de um responsável e uma data.',
    ],
    material: [
      {
        titulo: 'Roteiro da reunião (30 minutos)',
        tabela: {
          colunas: ['Minutos', 'O que fazer'],
          linhas: [
            ['0–5', 'Boas-vindas e objetivo do trabalho.'],
            ['5–10', 'O que é o Estadia (use "O projeto em 1 minuto" deste guia).'],
            ['10–20', 'Mostrar o site: as 4 frentes, as tarefas e como enviar entregas.'],
            ['20–25', 'Cronograma das 4 semanas.'],
            ['25–30', 'Combinados e próximos passos (ler a ata em voz alta).'],
          ],
        },
      },
      {
        titulo: 'Mensagem pronta para convidar o grupo',
        texto: 'Oi, pessoal! Reunião de início do trabalho do Estadia: [dia] às [hora], 30 minutos, [link]. Antes, escolham sua vaga no site da divisão de funções: [link do site].',
      },
    ],
    dicas: ['Coordenação fala, Documentação anota: não tentem fazer as duas coisas ao mesmo tempo.'],
    erros: ['Terminar sem datas. "Vamos ver depois" não é combinado.'],
  },
  A3: {
    saber: [
      'Linha de base = a primeira versão do cronograma, guardada sem mudar.',
      'SPI = tarefas prontas ÷ tarefas que deveriam estar prontas. 1 = no prazo; abaixo de 1 = atrasado; acima de 1 = adiantado.',
    ],
    material: [
      {
        titulo: 'Todas as entregas do grupo (para o cronograma)',
        tabela: {
          colunas: ['Semana', 'Entregas'],
          linhas: [
            ['1', 'A1 Canvas · A2 Ata do kick-off · B1 Backlog · B2 Kanban · C1 OKR · D1 Conversa com a dona'],
            ['2', 'A3 Cronograma · B3 Sprint · C2 Indicadores · D2 Manuais'],
            ['3', 'B4 Reuniões · C3 Painel · D3 Treinamento'],
            ['4', 'D4 Quem decide o quê · A4 Trabalho final'],
          ],
        },
      },
      {
        titulo: 'Três exemplos de SPI',
        tabela: {
          colunas: ['Deveriam estar prontas', 'Estão prontas', 'SPI', 'Significa'],
          linhas: [
            ['6', '6', '1,00', 'No prazo'],
            ['8', '6', '0,75', 'Atrasado: conversar com quem atrasou'],
            ['5', '6', '1,20', 'Adiantado'],
          ],
        },
      },
    ],
    dicas: ['No Google Sheets, a coluna SPI pode ser a fórmula =C2/B2.', 'Atualizem toda sexta-feira, no mesmo horário.'],
    erros: ['Mudar as datas da linha de base quando algo atrasa. Ela fica igual; quem muda é a "data real".'],
  },
  A4: {
    saber: ['O trabalho final junta as entregas das 4 frentes, na ordem A, B, C e D.'],
    material: [
      {
        titulo: 'Estrutura do documento final',
        passos: [
          'Capa e sumário.',
          'Introdução: o que é o Estadia (1 parágrafo).',
          'Frente A: Canvas, ata e cronograma com SPI.',
          'Frente B: backlog, Kanban, sprint e reuniões.',
          'Frente C: OKR, indicadores e painel.',
          'Frente D: conversa com a dona, manuais, treinamento e governança.',
          'Lições aprendidas e conclusão.',
        ],
      },
      {
        titulo: 'Slides sugeridos (10 a 12)',
        lista: ['1 abertura', '1 o que é o Estadia', '2 por frente (8 no total)', '1 lições aprendidas', '1 encerramento'],
      },
    ],
    dicas: ['Baixem as entregas pelo site: a mais recente fica no topo de cada frente.', 'Ensaiem com cronômetro: cerca de 2 minutos por frente.'],
    erros: ['Colar as entregas sem revisar: confiram se todas as tabelas estão preenchidas.'],
  },
  // ----- Frente B -----
  B1: {
    saber: [
      'Backlog = lista do que o sistema faz, em ordem de importância.',
      'Cada item é escrito do ponto de vista de quem usa: "Como [quem], quero [o quê], para [por quê]".',
    ],
    material: [
      {
        titulo: 'O que o Estadia faz (escolham 10 e escrevam no formato)',
        tabela: {
          colunas: ['Quem usa', 'O que o sistema faz'],
          linhas: [
            ['Recepcionista', 'Ver quais quartos estão livres numa data'],
            ['Recepcionista', 'Fazer uma reserva sem vender quarto já ocupado'],
            ['Recepcionista', 'Fazer check-in e preencher a ficha do hóspede'],
            ['Recepcionista', 'Lançar consumo (frigobar, restaurante) na conta'],
            ['Recepcionista', 'Fazer check-out e receber o pagamento'],
            ['Recepcionista', 'Abrir e fechar o caixa do turno'],
            ['Recepcionista', 'Bloquear a tela com PIN ao sair do computador'],
            ['Governança', 'Ver quais quartos precisam de limpeza'],
            ['Governança', 'Marcar o quarto como limpo pelo celular'],
            ['Gerente', 'Ver a ocupação e a receita do mês'],
            ['Gerente', 'Mudar o preço das diárias'],
            ['Gerente', 'Fechar o dia do hotel'],
            ['Financeiro', 'Cobrar empresas que pagam depois'],
            ['Administrador', 'Criar usuários para os funcionários'],
            ['Dona do hotel', 'Ver quem fez cada alteração (auditoria)'],
          ],
        },
      },
      {
        titulo: 'Como dar prioridade',
        tabela: {
          colunas: ['Prioridade', 'Quando usar'],
          linhas: [
            ['Alta', 'Sem isso o hotel não consegue trabalhar (reserva, check-in, caixa).'],
            ['Média', 'Ajuda muito, mas dá para viver sem por alguns dias (relatórios).'],
            ['Baixa', 'É bom ter (ex.: bloquear tela com PIN).'],
          ],
        },
      },
    ],
    dicas: ['Leiam em voz alta: se soar como fala de um funcionário do hotel, está certo.'],
    erros: ['Escrever tarefa técnica ("criar o banco de dados"). O backlog fala do que o usuário quer.'],
  },
  B2: {
    saber: ['Kanban = quadro com colunas. O cartão anda para a direita conforme a tarefa avança.', 'Limite de "Fazendo" evita começar tudo e não terminar nada.'],
    material: [
      {
        titulo: 'Trello passo a passo',
        passos: [
          'Entrem em trello.com e criem uma conta gratuita.',
          'Criem um quadro: "Projeto Estadia".',
          'Criem 3 listas: A fazer · Fazendo · Feito.',
          'Criem um cartão para cada entrega (lista abaixo).',
          'Em cada cartão: Etiquetas → cor da frente.',
          'Menu → Compartilhar → copiem o link e mandem no grupo.',
        ],
      },
      {
        titulo: 'Cartões e cores',
        tabela: {
          colunas: ['Frente', 'Cor', 'Cartões'],
          linhas: [
            ['A', 'Azul', 'A1 Canvas · A2 Ata · A3 Cronograma · A4 Trabalho final'],
            ['B', 'Roxo', 'B1 Backlog · B2 Kanban · B3 Sprint · B4 Reuniões'],
            ['C', 'Amarelo', 'C1 OKR · C2 Indicadores · C3 Painel'],
            ['D', 'Verde', 'D1 Conversa · D2 Manuais · D3 Treinamento · D4 Quem decide'],
          ],
        },
      },
    ],
    dicas: ['Usem as mesmas cores do site: fica fácil achar a frente de cada cartão.'],
    erros: ['Esquecer de convidar o grupo: o quadro só funciona se todos mexem nos próprios cartões.'],
  },
  B3: {
    saber: [
      'Objetivo da sprint = UMA frase que diz o que estará pronto no fim da semana.',
      'Capacidade = pessoas × horas por dia × dias. O planejado não pode passar disso.',
    ],
    material: [
      {
        titulo: 'Horas sugeridas por tarefa (do Passo a passo de cada frente)',
        tabela: {
          colunas: ['Tarefa', 'Horas'],
          linhas: [
            ['A3 Cronograma', '1'],
            ['B3 Sprint', '1'],
            ['C2 Indicadores', '1,5'],
            ['D2 Manuais', '2'],
            ['Cada pessoa por dia (média)', '1'],
          ],
        },
      },
      { titulo: 'Exemplo de capacidade', texto: '8 pessoas × 1 hora por dia × 5 dias = 40 horas na semana.' },
    ],
    dicas: ['Se a soma passar de 40 h, deixem para a próxima semana o que for menos importante.'],
    erros: ['Objetivo em forma de lista de tarefas. Ex. ruim: "fazer B3, C2, D2". Ex. bom: "terminar a 1ª versão de todas as entregas".'],
  },
  B4: {
    saber: ['Daily: 15 minutos, 3 perguntas. Pode ser por mensagem.', 'Retrospectiva: olhar para trás e escolher 3 melhorias.'],
    material: [
      {
        titulo: 'Mensagem pronta da daily (para o grupo)',
        texto: 'Bom dia! Daily de hoje. Cada frente responde: 1) O que fez desde ontem? 2) O que vai fazer hoje? 3) Tem algo travando?',
      },
      {
        titulo: 'Formato da retrospectiva',
        tabela: {
          colunas: ['Pergunta', 'Exemplo de resposta'],
          linhas: [
            ['O que foi bem?', 'Todo mundo escolheu a vaga no primeiro dia.'],
            ['O que melhorar?', 'Algumas entregas chegaram na última hora.'],
            ['Que ação vamos fazer?', 'Coordenação manda lembrete na quarta-feira.'],
          ],
        },
      },
    ],
    dicas: ['Anotem os impedimentos e cobrem a solução na daily seguinte.'],
    erros: ['Daily virar reunião longa. Se um assunto demorar, marquem uma conversa separada.'],
  },
  // ----- Frente C -----
  C1: {
    saber: ['Objetivo: frase inspiradora, SEM números.', 'Resultado-chave: número de antes → número da meta. Não é tarefa.'],
    material: [
      {
        titulo: 'Ideias de resultados-chave para o hotel (escolham 3)',
        tabela: {
          colunas: ['Resultado-chave', 'Antes (estimado)', 'Meta'],
          linhas: [
            ['Tempo médio de check-in', '8 min', '3 min'],
            ['Reservas vendidas em dobro por mês', '3', '0'],
            ['Erros de cobrança por mês', '10', '2'],
            ['Tempo para fechar o caixa', '40 min', '15 min'],
            ['Dias com o fechamento do dia feito', '50%', '100%'],
          ],
        },
      },
      {
        titulo: 'Exemplos de objetivo',
        lista: ['Deixar a recepção rápida e sem erros.', 'Dar à dona do hotel controle total do dia a dia.', 'Acabar com o caderno e a planilha na recepção.'],
      },
    ],
    dicas: ['"Antes" pode ser estimado: escrevam a fonte (palpite da dona, observação, pesquisa).'],
    erros: ['Resultado-chave como tarefa: "instalar o sistema" é tarefa; "check-in em 3 minutos" é resultado.'],
  },
  C2: {
    saber: ['Um bom indicador ajuda a decidir alguma coisa.', 'Os 4 indicadores já são calculados pelo sistema (tela Relatórios).'],
    material: [
      {
        titulo: 'Os 4 indicadores explicados',
        tabela: {
          colunas: ['Indicador', 'Fórmula', 'Meta sugerida', 'Decisão que ajuda'],
          linhas: [
            ['Taxa de ocupação', 'quartos ocupados ÷ quartos do hotel', '70%', 'Baixa? Fazer promoção.'],
            ['Diária média', 'receita das diárias ÷ quartos vendidos', 'R$ 240', 'Muito baixa? Rever descontos.'],
            ['RevPAR', 'receita das diárias ÷ todos os quartos', 'R$ 168', 'Mostra se preço e ocupação estão equilibrados.'],
            ['No-show', 'reservas que não vieram ÷ reservas', 'até 5%', 'Alto? Cobrar sinal na reserva.'],
          ],
        },
      },
      {
        titulo: 'Conta de exemplo (um mês)',
        texto: '50 quartos × 30 dias = 1.500 noites. Vendidas: 1.050 noites. Receita das diárias: R$ 252.000. Ocupação = 1.050 ÷ 1.500 = 70%. Diária média = 252.000 ÷ 1.050 = R$ 240. RevPAR = 252.000 ÷ 1.500 = R$ 168.',
      },
    ],
    dicas: ['Refaçam a conta de exemplo na calculadora antes de preencher: se bater, entenderam.'],
    erros: ['Confundir diária média (divide pelos quartos vendidos) com RevPAR (divide por todos os quartos).'],
  },
  C3: {
    saber: ['Painel bom se entende em 30 segundos: número, meta e cor.'],
    material: [
      {
        titulo: 'Números de exemplo para a planilha (4 semanas)',
        tabela: {
          colunas: ['Semana', 'Ocupação', 'Diária média', 'No-show'],
          linhas: [
            ['1', '62%', 'R$ 230', '6%'],
            ['2', '68%', 'R$ 236', '5%'],
            ['3', '74%', 'R$ 244', '4%'],
            ['4', '76%', 'R$ 248', '4%'],
          ],
        },
      },
      {
        titulo: 'Google Sheets passo a passo',
        passos: [
          'Digitem a tabela acima.',
          'Selecionem as colunas Semana e Ocupação → Inserir → Gráfico (linha).',
          'Formatar → Formatação condicional: verde se atingiu a meta, amarelo se está perto, vermelho se está longe.',
          'No no-show é ao contrário: quanto menor, melhor.',
        ],
      },
      { titulo: 'Modelo de análise (3 frases)', texto: 'A ocupação subiu de 62% para 76% em 4 semanas e passou da meta. O no-show caiu para 4%. Recomendamos manter os preços e cobrar sinal nas reservas de fim de semana.' },
    ],
    dicas: ['Ponham ícones ou a palavra (OK / Atenção / Problema) junto da cor: nem todo mundo enxerga cores igual.'],
    erros: ['Gráfico sem título e sem unidade (%). Sempre digam o que é o número.'],
  },
  // ----- Frente D -----
  D1: {
    saber: ['Business Partner = ponte. Vocês levam perguntas e trazem decisões; quem decide é a dona.'],
    material: [
      {
        titulo: 'As 6 perguntas mais importantes do questionário',
        lista: [
          'Quais são os tipos de quarto e quantos há de cada?',
          'O preço muda em fim de semana, temporada ou feriado?',
          'Até quando o hóspede pode cancelar sem multa?',
          'Quais formas de pagamento o hotel aceita?',
          'Quantos funcionários vão usar o sistema, e em que funções?',
          'Quais números a dona quer ver todo dia?',
        ],
      },
      { titulo: 'Mensagem para a Frente B depois da conversa', texto: 'Oi, Frente B! A dona decidiu: [decisão 1], [decisão 2]. Isso muda o item [nº] do backlog?' },
    ],
    dicas: ['Peçam licença para anotar. Repitam a resposta em voz alta para confirmar.', 'O questionário salva as respostas sozinho e gera um arquivo para baixar.'],
    erros: ['Prometer coisas para a dona. Vocês recomendam; o grupo e a dona decidem juntos.'],
  },
  D2: {
    saber: ['Manual bom cabe em uma página: passos numerados, frases curtas e um print por passo.'],
    material: [
      {
        titulo: 'Recepção: fazer o check-in (passos reais do sistema)',
        passos: [
          'Menu Reservas → aba "Chegadas hoje".',
          'Clique na reserva do hóspede.',
          'Clique no botão verde "Check-in".',
          'Complete ou revise a ficha do hóspede.',
          'Confira o quarto escolhido.',
          'Clique em confirmar o check-in.',
        ],
      },
      {
        titulo: 'Governança: marcar o quarto como limpo (pelo celular)',
        passos: [
          'Entre no sistema pelo celular.',
          'Toque em "Governança" no menu de baixo.',
          'Cada toque no cartão do quarto avança o status: Sujo → Em limpeza → Limpo → Inspecionado.',
        ],
      },
      { titulo: 'Modelo de cada página', lista: ['Título: "Como fazer o check-in".', 'Para quem: Recepção.', 'Passos numerados com print.', 'Se der errado: chame a gerência.'] },
    ],
    dicas: ['Para print no celular, usem o usuário de Governança que o dev de apoio criar.'],
    erros: ['Print com nome de hóspede real. Usem só a versão de demonstração (dados inventados).'],
  },
  D3: {
    saber: ['"Projeto Melancia": verde por fora (sistema entregue), vermelho por dentro (ninguém usa). O treinamento evita isso.'],
    material: [
      {
        titulo: 'O que cada função precisa aprender',
        tabela: {
          colunas: ['Função', 'Conteúdo', 'Duração'],
          linhas: [
            ['Recepção', 'Login e PIN, mapa do dia, reserva, check-in, check-out, caixa', '2 h'],
            ['Governança', 'Login pelo celular, lista de quartos, mudar status', '30 min'],
            ['Gerência', 'Relatórios, preços e fechamento do dia', '1 h'],
          ],
        },
      },
      {
        titulo: 'Dificuldades comuns e como ajudar',
        tabela: {
          colunas: ['Dificuldade', 'Como ajudar'],
          linhas: [
            ['Medo de errar no caixa', 'Treinar com a versão de demonstração antes'],
            ['Pouca prática com computador', 'Manual de uma página do lado do computador'],
            ['Turno da noite sem ajuda', 'Telefone de quem chamar escrito no manual'],
            ['Esquecer a senha', 'Usar o PIN de 4 números para desbloquear'],
          ],
        },
      },
    ],
    dicas: ['Treinem uma função por vez, com o manual da D2 na mão.'],
    erros: ['Treinar tudo para todos: cada função aprende só o que usa.'],
  },
  D4: {
    saber: ['Governança = deixar claro quem decide cada assunto.', 'Privacidade: o hóspede tem direito de saber o que o hotel guarda dele.'],
    material: [
      {
        titulo: 'Os 3 modelos de decisão da aula',
        tabela: {
          colunas: ['Modelo', 'Quem decide', 'Exemplo'],
          linhas: [
            ['Monarquia de Negócio', 'A dona do hotel', 'Preço das diárias'],
            ['Monarquia de TI', 'O time técnico (devs)', 'Backup e segurança'],
            ['Duopólio', 'Dona + time técnico juntos', 'Novas funções no sistema'],
          ],
        },
      },
      {
        titulo: 'Fatos para o aviso de privacidade',
        lista: [
          'O hotel guarda os dados da ficha porque a lei exige e para cumprir a reserva.',
          'Os dados ficam guardados por 5 anos depois da última hospedagem.',
          'Só os funcionários que precisam conseguem ver os dados.',
          'O hóspede pode pedir informações sobre os seus dados na recepção.',
        ],
      },
      {
        titulo: 'Modelo de aviso (completem)',
        texto: 'Seus dados estão seguros. O [nome do hotel] guarda as informações da sua ficha porque a lei exige e para cuidar da sua reserva. Elas ficam guardadas por 5 anos e só a nossa equipe autorizada tem acesso. Dúvidas? Fale com a recepção.',
      },
    ],
    dicas: ['Criar usuários é decisão de quem administra o hotel (a dona ou a gerência), com apoio técnico.'],
    erros: ['Dizer que "cada um decide" algum assunto: isso é Anarquia, o modelo que a aula manda evitar.'],
  },
};
