// GERADO de docs/schema-celular.sql (script gen_mobile_schema.py). Só o que existe no celular.
// Para mudar o banco, não edite aqui: crie uma migração nova em migrations.ts.
export const schemaV1 = `
CREATE TABLE usuario (
  id                            TEXT PRIMARY KEY,
  nome                          TEXT NOT NULL,
  email                         TEXT NOT NULL,
  curso                         TEXT,
  instituicao                   TEXT,
  fuso_horario                  TEXT NOT NULL DEFAULT 'America/Araguaina',
  tema                          TEXT NOT NULL DEFAULT 'sistema' CHECK (tema IN ('claro','escuro','sistema')),
  cidade_cotacoes               TEXT NOT NULL DEFAULT 'Palmas-TO',
  latitude_padrao               REAL,
  longitude_padrao              REAL,
  -- avisos e preferências
  aviso_provas_entregas         INTEGER NOT NULL DEFAULT 1 CHECK (aviso_provas_entregas IN (0,1)),
  aviso_vespera_campo           INTEGER NOT NULL DEFAULT 1 CHECK (aviso_vespera_campo IN (0,1)),
  aviso_entrega_relatorio       INTEGER NOT NULL DEFAULT 1 CHECK (aviso_entrega_relatorio IN (0,1)),
  lembrar_registro_pos_campo    INTEGER NOT NULL DEFAULT 1 CHECK (lembrar_registro_pos_campo IN (0,1)),
  hora_lembrete_pos_campo       TEXT NOT NULL DEFAULT '18:00',
  apagar_audio_apos_transcricao INTEGER NOT NULL DEFAULT 0 CHECK (apagar_audio_apos_transcricao IN (0,1)),
  enviar_fotos_so_wifi          INTEGER NOT NULL DEFAULT 1 CHECK (enviar_fotos_so_wifi IN (0,1)),
  --
  aceitou_termos_em             TEXT NOT NULL,
  primeiro_acesso_concluido_em  TEXT,
  ultimo_login_em               TEXT,
  criado_em                     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status                   TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao                        INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX usuario_email_unico ON usuario (lower(email));

-- ============================================================================
-- 2. PERÍODO, PROFESSOR E MATÉRIA
-- ============================================================================

CREATE TABLE periodo (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  data_inicio    TEXT NOT NULL,
  data_fim       TEXT,
  status         TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','finalizado')),
  finalizado_em  TEXT,
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);
-- no máximo UM período ativo por usuário
CREATE UNIQUE INDEX periodo_um_ativo ON periodo (usuario_id) WHERE status = 'ativo';

CREATE TABLE professor (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  email          TEXT,
  observacoes    TEXT,
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id)
);

CREATE TABLE materia (
  id               TEXT PRIMARY KEY,
  usuario_id       TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  periodo_id       TEXT NOT NULL,
  professor_id     TEXT,
  nome             TEXT NOT NULL,
  tipo_aula        TEXT NOT NULL DEFAULT 'sala' CHECK (tipo_aula IN ('sala','campo','sala_e_campo')),
  cor              TEXT NOT NULL DEFAULT 'verde' CHECK (cor IN ('azul','verde','terra','roxo','vermelho')),
  lembrar_vespera  INTEGER NOT NULL DEFAULT 1 CHECK (lembrar_vespera IN (0,1)),
  desativada       INTEGER NOT NULL DEFAULT 0 CHECK (desativada IN (0,1)),
  criado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao           INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  FOREIGN KEY (usuario_id, periodo_id)   REFERENCES periodo(usuario_id, id),
  FOREIGN KEY (usuario_id, professor_id) REFERENCES professor(usuario_id, id)
);
CREATE INDEX materia_periodo ON materia (usuario_id, periodo_id);

-- dias da semana da matéria: 1 = segunda ... 6 = sábado, 7 = domingo
CREATE TABLE materia_dia (
  materia_id  TEXT NOT NULL REFERENCES materia(id) ON DELETE CASCADE,
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  PRIMARY KEY (materia_id, dia_semana)
);

-- ============================================================================
-- 3. TAGS
-- ============================================================================

CREATE TABLE tag (
  id          TEXT PRIMARY KEY,
  usuario_id  TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  UNIQUE (usuario_id, id),
  UNIQUE (usuario_id, nome)
);

-- ============================================================================
-- 4. RELATÓRIOS, REGISTROS, PENDÊNCIAS, FOTOS E ÁUDIOS
-- ============================================================================

CREATE TABLE relatorio (
  id                  TEXT PRIMARY KEY,
  usuario_id          TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  materia_id          TEXT NOT NULL,
  titulo              TEXT NOT NULL,
  tipo                TEXT NOT NULL CHECK (tipo IN ('continuo','pontual')),
  status              TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','finalizado')),
  finalizado_em       TEXT,
  finalizado_por      TEXT CHECK (finalizado_por IN ('usuario','periodo')),
  data_entrega        TEXT,
  lembrete_entrega    TEXT NOT NULL DEFAULT 'nenhum' CHECK (lembrete_entrega IN ('nenhum','no_dia','1_dia','3_dias','1_semana')),
  observacoes         TEXT,
  -- área acompanhada (relatório contínuo)
  area_cultura        TEXT,
  area_local          TEXT,
  area_comprimento_m  REAL CHECK (area_comprimento_m IS NULL OR area_comprimento_m > 0),
  area_largura_m      REAL CHECK (area_largura_m IS NULL OR area_largura_m > 0),
  area_m2             REAL GENERATED ALWAYS AS (area_comprimento_m * area_largura_m) STORED,
  area_foto_id        TEXT,
  criado_em           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao              INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  FOREIGN KEY (usuario_id, materia_id) REFERENCES materia(usuario_id, id)
);
CREATE INDEX relatorio_lista   ON relatorio (usuario_id, status, materia_id);
CREATE INDEX relatorio_entrega ON relatorio (usuario_id, data_entrega) WHERE status = 'em_andamento';

CREATE TABLE registro (
  id                   TEXT PRIMARY KEY,
  usuario_id           TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  relatorio_id         TEXT NOT NULL,
  data_hora            TEXT NOT NULL,                       -- quando a visita aconteceu (horário do celular, em UTC)
  status               TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','concluido')),
  atividades           TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(atividades)),   -- ["vistoria","limpeza",...]
  aplicacao_produto    TEXT,
  aplicacao_dose       TEXT,
  aplicacao_alvo       TEXT,
  irrigacao            TEXT CHECK (irrigacao IN ('funcionando','com_falha','sem_irrigacao','a_instalar')),
  altura_plantas_cm    REAL,
  area_medida_m2       REAL,
  cultura_estado       TEXT CHECK (cultura_estado IN ('otima','boa','regular','ruim')),
  estagio              TEXT,
  houve_praga          INTEGER NOT NULL DEFAULT 0 CHECK (houve_praga IN (0,1)),
  praga_nome           TEXT,
  praga_nivel          TEXT CHECK (praga_nivel IN ('baixo','medio','alto')),
  observacoes          TEXT,
  -- localização do aparelho e clima congelado na criação
  latitude             REAL CHECK (latitude  BETWEEN -90  AND 90),
  longitude            REAL CHECK (longitude BETWEEN -180 AND 180),
  clima_origem         TEXT CHECK (clima_origem IN ('gps','manual','pendente','gps_atrasado')),
  clima_descricao      TEXT,
  clima_temperatura_c  REAL,
  clima_sensacao_c     REAL,
  clima_umidade_pct    INTEGER CHECK (clima_umidade_pct BETWEEN 0 AND 100),
  clima_vento_kmh      REAL,
  clima_chuva_1h_mm    REAL,
  clima_medido_em      TEXT,
  criado_em            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao               INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  FOREIGN KEY (usuario_id, relatorio_id) REFERENCES relatorio(usuario_id, id) ON DELETE CASCADE,
  CHECK (houve_praga = 0 OR praga_nome IS NOT NULL)
);
CREATE INDEX registro_linha_do_tempo ON registro (usuario_id, relatorio_id, data_hora DESC);
CREATE INDEX registro_rascunho       ON registro (usuario_id) WHERE status = 'rascunho';

-- "Para a próxima visita"
CREATE TABLE registro_pendencia (
  id                    TEXT PRIMARY KEY,
  usuario_id            TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  registro_id           TEXT NOT NULL,                    -- registro em que o item foi criado
  texto                 TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 200),
  ordem                 INTEGER NOT NULL DEFAULT 0,
  feito                 INTEGER NOT NULL DEFAULT 0 CHECK (feito IN (0,1)),
  feito_no_registro_id  TEXT,                             -- registro em que foi marcado como feito
  feito_em              TEXT,
  criado_em             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao                INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  FOREIGN KEY (usuario_id, registro_id)          REFERENCES registro(usuario_id, id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id, feito_no_registro_id) REFERENCES registro(usuario_id, id) ON DELETE SET NULL
);
CREATE INDEX registro_pendencia_abertas ON registro_pendencia (usuario_id, registro_id) WHERE feito = 0;

-- ============================================================================
-- 5. EVENTOS (provas, entregas, atividades)
-- ============================================================================

CREATE TABLE evento (
  id                     TEXT PRIMARY KEY,
  usuario_id             TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  materia_id             TEXT,
  relatorio_id           TEXT,
  tipo                   TEXT NOT NULL CHECK (tipo IN ('prova','trabalho','entrega_relatorio','atividade','evento_faculdade','outro')),
  descricao_tipo         TEXT,
  titulo                 TEXT NOT NULL,
  data                   TEXT NOT NULL,
  lembrete               TEXT NOT NULL DEFAULT 'nenhum' CHECK (lembrete IN ('nenhum','no_dia','1_dia','3_dias','1_semana')),
  anotacoes              TEXT,
  concluido              INTEGER NOT NULL DEFAULT 0 CHECK (concluido IN (0,1)),
  encerrado_com_periodo  INTEGER NOT NULL DEFAULT 0 CHECK (encerrado_com_periodo IN (0,1)),
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao                 INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  FOREIGN KEY (usuario_id, materia_id)   REFERENCES materia(usuario_id, id),
  FOREIGN KEY (usuario_id, relatorio_id) REFERENCES relatorio(usuario_id, id) ON DELETE CASCADE,
  CHECK (tipo <> 'outro' OR descricao_tipo IS NOT NULL)
);
CREATE INDEX evento_agenda ON evento (usuario_id, data) WHERE encerrado_com_periodo = 0;
-- um relatório tem no máximo um evento de entrega
CREATE UNIQUE INDEX evento_um_por_relatorio ON evento (relatorio_id) WHERE relatorio_id IS NOT NULL;

-- ============================================================================
-- 6. ANOTAÇÕES
-- ============================================================================

CREATE TABLE anotacao (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  materia_id     TEXT,                                    -- vazio = anotação solta
  titulo         TEXT NOT NULL,
  texto          TEXT,
  link           TEXT CHECK (link IS NULL OR link LIKE 'http://%' OR link LIKE 'https://%'),
  fixada         INTEGER NOT NULL DEFAULT 0 CHECK (fixada IN (0,1)),
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  FOREIGN KEY (usuario_id, materia_id) REFERENCES materia(usuario_id, id)
);
CREATE INDEX anotacao_lista   ON anotacao (usuario_id, fixada DESC, atualizado_em DESC);
CREATE INDEX anotacao_materia ON anotacao (usuario_id, materia_id);

-- ============================================================================
-- 7. FOTOS, ANEXOS E ÁUDIOS
-- ============================================================================

-- foto de um registro, da área de um relatório OU de um evento (exatamente um dos três)
CREATE TABLE foto (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  registro_id    TEXT,
  relatorio_id   TEXT,
  evento_id      TEXT,
  arquivo        TEXT,                                    -- caminho no armazenamento (servidor) ou no celular
  miniatura      TEXT,
  tipo_mime      TEXT NOT NULL,
  tamanho_bytes  INTEGER NOT NULL CHECK (tamanho_bytes > 0),
  legenda        TEXT,
  tirada_em      TEXT,
  latitude       REAL,
  longitude      REAL,
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  FOREIGN KEY (usuario_id, registro_id)  REFERENCES registro(usuario_id, id)  ON DELETE CASCADE,
  FOREIGN KEY (usuario_id, relatorio_id) REFERENCES relatorio(usuario_id, id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id, evento_id)    REFERENCES evento(usuario_id, id)    ON DELETE CASCADE,
  CHECK ((registro_id IS NOT NULL) + (relatorio_id IS NOT NULL) + (evento_id IS NOT NULL) = 1)
);
CREATE INDEX foto_registro ON foto (usuario_id, registro_id);
CREATE INDEX foto_evento   ON foto (usuario_id, evento_id);

CREATE TABLE anexo (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  anotacao_id    TEXT NOT NULL,
  arquivo        TEXT,
  miniatura      TEXT,
  tipo_mime      TEXT NOT NULL,
  tamanho_bytes  INTEGER NOT NULL CHECK (tamanho_bytes > 0),
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (usuario_id, anotacao_id) REFERENCES anotacao(usuario_id, id) ON DELETE CASCADE
);

-- áudio gravado no registro ou na anotação; a transcrição é feita no servidor
CREATE TABLE audio (
  id                   TEXT PRIMARY KEY,
  usuario_id           TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  registro_id          TEXT,
  anotacao_id          TEXT,
  arquivo              TEXT,                              -- nulo depois de apagar o áudio
  tipo_mime            TEXT NOT NULL,
  duracao_s            INTEGER NOT NULL CHECK (duracao_s BETWEEN 1 AND 300),
  tamanho_bytes        INTEGER NOT NULL CHECK (tamanho_bytes > 0),
  gravado_em           TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'transcrevendo' CHECK (status IN ('transcrevendo','pronto','erro')),
  idioma               TEXT NOT NULL DEFAULT 'pt-BR',
  transcricao          TEXT,
  transcricao_editada  TEXT,                              -- o que o usuário ajustou; vale mais que a transcrição
  confianca            REAL,
  tentativas           INTEGER NOT NULL DEFAULT 0,
  erro                 TEXT,
  transcrito_em        TEXT,
  criado_em            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sync_status TEXT NOT NULL DEFAULT 'sincronizado' CHECK (sync_status IN ('sincronizado','pendente','erro')),
  versao               INTEGER NOT NULL DEFAULT 1,
  UNIQUE (usuario_id, id),
  FOREIGN KEY (usuario_id, registro_id) REFERENCES registro(usuario_id, id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id, anotacao_id) REFERENCES anotacao(usuario_id, id) ON DELETE CASCADE,
  CHECK ((registro_id IS NOT NULL) + (anotacao_id IS NOT NULL) = 1)
);
-- fila de transcrição (o servidor lê as linhas pendentes)
CREATE INDEX audio_pendentes ON audio (criado_em) WHERE status = 'transcrevendo';

-- ============================================================================
-- 8. LIGAÇÕES COM TAGS
-- ============================================================================

CREATE TABLE relatorio_tag (
  usuario_id    TEXT NOT NULL,
  relatorio_id  TEXT NOT NULL,
  tag_id        TEXT NOT NULL,
  PRIMARY KEY (relatorio_id, tag_id),
  FOREIGN KEY (usuario_id, relatorio_id) REFERENCES relatorio(usuario_id, id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id, tag_id)       REFERENCES tag(usuario_id, id)       ON DELETE CASCADE
);
CREATE TABLE registro_tag (
  usuario_id   TEXT NOT NULL,
  registro_id  TEXT NOT NULL,
  tag_id       TEXT NOT NULL,
  PRIMARY KEY (registro_id, tag_id),
  FOREIGN KEY (usuario_id, registro_id) REFERENCES registro(usuario_id, id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id, tag_id)      REFERENCES tag(usuario_id, id)      ON DELETE CASCADE
);
CREATE TABLE anotacao_tag (
  usuario_id   TEXT NOT NULL,
  anotacao_id  TEXT NOT NULL,
  tag_id       TEXT NOT NULL,
  PRIMARY KEY (anotacao_id, tag_id),
  FOREIGN KEY (usuario_id, anotacao_id) REFERENCES anotacao(usuario_id, id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id, tag_id)      REFERENCES tag(usuario_id, id)      ON DELETE CASCADE
);

-- ============================================================================
-- 12. SÓ NO CELULAR: fila de envio e estado da sincronização
-- ============================================================================

CREATE TABLE fila_envio (
  id                     TEXT PRIMARY KEY,                -- é o id_operacao
  entidade               TEXT NOT NULL,
  entidade_id            TEXT NOT NULL,
  operacao               TEXT NOT NULL CHECK (operacao IN ('criar','alterar','excluir','encerrar_periodo')),
  dados                  TEXT CHECK (dados IS NULL OR json_valid(dados)),
  versao_base            INTEGER,
  feito_em               TEXT NOT NULL,
  tentativas             INTEGER NOT NULL DEFAULT 0,
  proxima_tentativa_em   TEXT,
  erro                   TEXT,
  status                 TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviando','erro')),
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX fila_envio_ordem ON fila_envio (status, criado_em);

CREATE TABLE fila_midia (
  id                     TEXT PRIMARY KEY,                -- id da foto, do anexo ou do áudio
  tipo                   TEXT NOT NULL CHECK (tipo IN ('foto','anexo','audio')),
  entidade               TEXT NOT NULL,                   -- 'registro', 'relatorio_area', 'anotacao', 'evento'
  entidade_id            TEXT NOT NULL,
  arquivo_local          TEXT NOT NULL,
  tentativas             INTEGER NOT NULL DEFAULT 0,
  proxima_tentativa_em   TEXT,
  status                 TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviando','erro','enviado')),
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE estado_sync (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  cursor              INTEGER NOT NULL DEFAULT 0,
  ultima_sync_em      TEXT,
  ultimo_erro         TEXT
);
INSERT INTO estado_sync (id) VALUES (1);

-- ============================================================================
-- 13. TRIGGERS: atualizado_em e versao
--  A versão só sobe quando quem atualiza NÃO mexeu na coluna versao.
--  (Ao aplicar uma mudança vinda do servidor, o celular grava a versao do servidor.)
-- ============================================================================

CREATE TRIGGER usuario_upd AFTER UPDATE ON usuario WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE usuario SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER periodo_upd AFTER UPDATE ON periodo WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE periodo SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER professor_upd AFTER UPDATE ON professor WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE professor SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER materia_upd AFTER UPDATE ON materia WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE materia SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER relatorio_upd AFTER UPDATE ON relatorio WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE relatorio SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER registro_upd AFTER UPDATE ON registro WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE registro SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER registro_pendencia_upd AFTER UPDATE ON registro_pendencia WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE registro_pendencia SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER evento_upd AFTER UPDATE ON evento WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE evento SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER anotacao_upd AFTER UPDATE ON anotacao WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE anotacao SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER foto_upd AFTER UPDATE ON foto WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE foto SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;
CREATE TRIGGER audio_upd AFTER UPDATE ON audio WHEN NEW.versao = OLD.versao AND NEW.sync_status = OLD.sync_status BEGIN
  UPDATE audio SET atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now'), versao = OLD.versao + 1 WHERE id = NEW.id; END;

-- ============================================================================
-- 14. BUSCA DE TEXTO (FTS5), sem acento e sem diferença de maiúsculas
--  Uma tabela só, mantida por triggers. O celular usa a mesma para a busca offline.
-- ============================================================================

CREATE VIRTUAL TABLE busca_indice USING fts5(
  usuario_id UNINDEXED, entidade UNINDEXED, entidade_id UNINDEXED,
  titulo, corpo,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- anotações
CREATE TRIGGER busca_anotacao_ins AFTER INSERT ON anotacao BEGIN
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'anotacao', NEW.id, NEW.titulo, coalesce(NEW.texto,'')); END;
CREATE TRIGGER busca_anotacao_upd AFTER UPDATE OF titulo, texto ON anotacao BEGIN
  DELETE FROM busca_indice WHERE entidade = 'anotacao' AND entidade_id = OLD.id;
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'anotacao', NEW.id, NEW.titulo, coalesce(NEW.texto,'')); END;
CREATE TRIGGER busca_anotacao_del AFTER DELETE ON anotacao BEGIN
  DELETE FROM busca_indice WHERE entidade = 'anotacao' AND entidade_id = OLD.id; END;

-- relatórios
CREATE TRIGGER busca_relatorio_ins AFTER INSERT ON relatorio BEGIN
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'relatorio', NEW.id, NEW.titulo, coalesce(NEW.observacoes,'')); END;
CREATE TRIGGER busca_relatorio_upd AFTER UPDATE OF titulo, observacoes ON relatorio BEGIN
  DELETE FROM busca_indice WHERE entidade = 'relatorio' AND entidade_id = OLD.id;
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'relatorio', NEW.id, NEW.titulo, coalesce(NEW.observacoes,'')); END;
CREATE TRIGGER busca_relatorio_del AFTER DELETE ON relatorio BEGIN
  DELETE FROM busca_indice WHERE entidade = 'relatorio' AND entidade_id = OLD.id; END;

-- registros
CREATE TRIGGER busca_registro_ins AFTER INSERT ON registro BEGIN
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'registro', NEW.id, coalesce(NEW.praga_nome,''),
          coalesce(NEW.observacoes,'') || ' ' || coalesce(NEW.aplicacao_produto,'')); END;
CREATE TRIGGER busca_registro_upd AFTER UPDATE OF observacoes, praga_nome, aplicacao_produto ON registro BEGIN
  DELETE FROM busca_indice WHERE entidade = 'registro' AND entidade_id = OLD.id;
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'registro', NEW.id, coalesce(NEW.praga_nome,''),
          coalesce(NEW.observacoes,'') || ' ' || coalesce(NEW.aplicacao_produto,'')); END;
CREATE TRIGGER busca_registro_del AFTER DELETE ON registro BEGIN
  DELETE FROM busca_indice WHERE entidade = 'registro' AND entidade_id = OLD.id; END;

-- matérias
CREATE TRIGGER busca_materia_ins AFTER INSERT ON materia BEGIN
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'materia', NEW.id, NEW.nome, ''); END;
CREATE TRIGGER busca_materia_upd AFTER UPDATE OF nome ON materia BEGIN
  DELETE FROM busca_indice WHERE entidade = 'materia' AND entidade_id = OLD.id;
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'materia', NEW.id, NEW.nome, ''); END;
CREATE TRIGGER busca_materia_del AFTER DELETE ON materia BEGIN
  DELETE FROM busca_indice WHERE entidade = 'materia' AND entidade_id = OLD.id; END;

-- eventos
CREATE TRIGGER busca_evento_ins AFTER INSERT ON evento BEGIN
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'evento', NEW.id, NEW.titulo, coalesce(NEW.anotacoes,'')); END;
CREATE TRIGGER busca_evento_upd AFTER UPDATE OF titulo, anotacoes ON evento BEGIN
  DELETE FROM busca_indice WHERE entidade = 'evento' AND entidade_id = OLD.id;
  INSERT INTO busca_indice (usuario_id, entidade, entidade_id, titulo, corpo)
  VALUES (NEW.usuario_id, 'evento', NEW.id, NEW.titulo, coalesce(NEW.anotacoes,'')); END;
CREATE TRIGGER busca_evento_del AFTER DELETE ON evento BEGIN
  DELETE FROM busca_indice WHERE entidade = 'evento' AND entidade_id = OLD.id; END;
`;
