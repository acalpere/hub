import { BRIEF } from "./catalog";

// Apunts d'estudi d'AWS: serveis i arquitectures. Text estàtic (es llegeix des del mòbil, sense servidor).
// Per afegir-ne un: una entrada a SERVICES o ARCHITECTURES; l'índex i les pàgines surten soles.

export interface Service {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  // Només els serveis amb apunts complets (SERVICES) en tenen; els del catàleg breu (catalog.ts), no.
  what?: string;
  concepts?: string[];
  useWhen?: string[];
  watch?: string[];
  related?: string[]; // slugs
}

export interface Architecture {
  slug: string;
  name: string;
  tagline: string;
  flow: string[]; // passos, de l'usuari cap a les dades
  why: string;
  tradeoffs: string[];
  services: string[]; // slugs
}

export const CATEGORIES = [
  "Còmput", "Emmagatzematge", "Bases de dades", "Xarxa i lliurament", "Integració", "Seguretat",
  "Anàlisi i dades", "IA i aprenentatge automàtic", "Desenvolupament i DevOps", "Operacions",
  "Migració", "IoT i mitjans", "Aplicacions i altres",
] as const;

const DETAILED: Service[] = [
  {
    slug: "ec2", name: "EC2", category: "Còmput", tagline: "Màquines virtuals llogades per segons.",
    what: "Elastic Compute Cloud et dona servidors virtuals amb el sistema, la mida i la xarxa que triïs. Tu en tens la responsabilitat: pegats, escalat i disponibilitat.",
    concepts: [
      "AMI: la imatge de disc de la qual neix la instància.",
      "Tipus d'instància: família (t, m, c, r…) i mida; les «t» tenen crèdits de CPU encesa a ràfegues.",
      "EBS: disc en xarxa persistent; l'emmagatzematge d'instància (instance store) es perd en aturar-la.",
      "Auto Scaling Group: crea i retira instàncies segons una plantilla i una mètrica.",
      "Models de preu: sota demanda, Reserved/Savings Plans (compromís d'1 o 3 anys) i Spot (barat, però et poden treure la màquina).",
    ],
    useWhen: ["Programari que necessita control del sistema o processos de llarga durada.", "Càrregues previsibles on un Savings Plan surt més barat que serverless."],
    watch: ["Una instància aturada no cobra còmput però el disc EBS sí.", "Una IP elàstica sense associar es cobra.", "Si és un sol servidor, és un punt únic de fallada."],
    related: ["vpc", "ebs-s3", "elb", "lambda"],
  },
  {
    slug: "lambda", name: "Lambda", category: "Còmput", tagline: "Codi que s'executa només quan cal, sense servidors a gestionar.",
    what: "Pujes una funció i AWS l'executa en resposta a un esdeveniment (HTTP, cua, fitxer a S3, calendari). Pagues per petició i per mil·lisegon de memòria.",
    concepts: [
      "Esdeveniment → funció: cada invocació rep un document JSON.",
      "Memòria (128 MB–10 GB) determina també la CPU; el temps màxim és de 15 minuts.",
      "Arrencada en fred (cold start): la primera petició després d'inactivitat és més lenta.",
      "Concurrència: moltes invocacions alhora = moltes còpies; es pot limitar o reservar.",
      "Capes (layers) i imatges de contenidor per a dependències grans.",
      "Function URL o API Gateway per exposar-la per HTTP.",
    ],
    useWhen: ["APIs i feines de tràfic irregular o baix (com aquest lloc).", "Reaccionar a esdeveniments: processar un fitxer en pujar-lo."],
    watch: ["Cada còpia obre les seves connexions a la base de dades: cal un pool intermedi (RDS Proxy, Neon pooler).", "El sistema de fitxers és efímer (/tmp).", "No és bo per a tràfic molt alt i constant: pot sortir més car que un contenidor."],
    related: ["api-gateway", "sqs", "eventbridge", "iam"],
  },
  {
    slug: "ecs-fargate", name: "ECS i Fargate", category: "Còmput", tagline: "Contenidors Docker gestionats, sense administrar servidors (Fargate).",
    what: "ECS orquestra contenidors; amb Fargate no cal tenir cap instància: defineixes CPU i memòria de la tasca i AWS la fa córrer.",
    concepts: ["Task definition: la «recepta» (imatge, CPU, memòria, variables).", "Service: manté N tasques vives darrere d'un balancejador.", "ECR: el registre d'imatges.", "EKS és l'alternativa si vols Kubernetes."],
    useWhen: ["APIs contínues amb dependències pesades.", "Feines llargues que no caben als 15 minuts de Lambda."],
    watch: ["Fargate es paga mentre la tasca és viva, tingui tràfic o no.", "Les tasques en subxarxes privades necessiten NAT o endpoints per baixar imatges."],
    related: ["elb", "vpc", "lambda"],
  },
  {
    slug: "s3", name: "S3", category: "Emmagatzematge", tagline: "Objectes (fitxers) il·limitats, duradors i barats.",
    what: "Simple Storage Service desa objectes dins de «buckets» amb una clau (el camí). Durabilitat de 11 nous; no és un disc sinó una API HTTP.",
    concepts: [
      "Bucket: contenidor amb nom únic mundial; objecte: dades + metadades, fins a 5 TB.",
      "Classes: Standard, Intelligent-Tiering, Standard-IA, Glacier (arxiu, recuperació lenta).",
      "Versionat: guarda versions i protegeix contra esborrats.",
      "Regles de cicle de vida: passar a una classe més barata o esborrar al cap de N dies.",
      "URL prefirmades: enllaç temporal per pujar o baixar sense donar credencials.",
      "Bloqueig d'accés públic: activat per defecte; mantén-lo i serveix per CloudFront.",
    ],
    useWhen: ["Fitxers d'usuari, còpies de seguretat, dades d'anàlisi, webs estàtiques.", "Llac de dades que després consulta Athena."],
    watch: ["Cobra per emmagatzematge, peticions i sortida cap a Internet.", "Els buckets públics per error són una causa clàssica de filtracions."],
    related: ["cloudfront", "iam", "lambda"],
  },
  {
    slug: "ebs-s3", name: "EBS, EFS i S3: quin disc?", category: "Emmagatzematge", tagline: "Bloc, fitxers o objectes: tres models diferents.",
    what: "EBS és un disc per a una instància EC2; EFS és un sistema de fitxers NFS compartit per moltes; S3 són objectes via API.",
    concepts: ["EBS: baixa latència, una sola zona de disponibilitat, es fan «snapshots» a S3.", "EFS: es creix sol, multi-zona, més car per GB.", "S3: el més barat i escalable, però no es munta com un disc."],
    useWhen: ["EBS per a la base de dades en una EC2.", "EFS per a fitxers compartits entre servidors.", "S3 per a gairebé tota la resta."],
    watch: ["Un volum EBS només viu en la zona on es crea."],
    related: ["ec2", "s3"],
  },
  {
    slug: "rds", name: "RDS i Aurora", category: "Bases de dades", tagline: "PostgreSQL/MySQL gestionats: còpies, pegats i rèpliques.",
    what: "RDS executa motors relacionals i s'encarrega de còpies automàtiques, actualitzacions i failover. Aurora és la versió reescrita per AWS, compatible amb PostgreSQL/MySQL, amb emmagatzematge compartit.",
    concepts: ["Multi-AZ: rèplica síncrona en una altra zona per a la tolerància a fallades.", "Rèpliques de lectura: reparteixen consultes de lectura.", "Aurora Serverless v2: capacitat que puja i baixa segons la càrrega.", "RDS Proxy: agrupa connexions (útil amb Lambda).", "Còpies i restauració a un instant concret (PITR)."],
    useWhen: ["Dades relacionals amb transaccions.", "Quan no vols administrar la base de dades tu mateix."],
    watch: ["Una instància encesa es paga 24/7 encara que no la facis servir.", "Multi-AZ duplica el cost.", "Escalar l'escriptura és vertical: una sola instància escriu."],
    related: ["vpc", "lambda", "dynamodb"],
  },
  {
    slug: "dynamodb", name: "DynamoDB", category: "Bases de dades", tagline: "Clau-valor sense servidors, amb latència de mil·lisegons a qualsevol escala.",
    what: "Base NoSQL totalment gestionada. Es dissenya la taula a partir de les consultes que es faran, no de les dades.",
    concepts: ["Clau de partició (+ clau d'ordenació opcional): determina on viu i com es llegeix.", "Mode sota demanda o aprovisionat (unitats de lectura/escriptura).", "Índexs secundaris (GSI/LSI) per a altres patrons d'accés.", "Streams: flux de canvis que pot activar una Lambda.", "TTL: caducitat automàtica d'elements."],
    useWhen: ["Accés per clau a gran escala, sessions, carrets, comptadors.", "Càrregues amb pics imprevisibles."],
    watch: ["No hi ha JOINs ni consultes lliures: un mal model de dades és difícil de canviar.", "Una «partició calenta» (clau molt usada) limita el rendiment."],
    related: ["lambda", "rds"],
  },
  {
    slug: "vpc", name: "VPC", category: "Xarxa i lliurament", tagline: "La teva xarxa privada dins d'AWS.",
    what: "Virtual Private Cloud és un rang d'IP aïllat on es posen els recursos. Decideixes què és públic i què privat.",
    concepts: ["Subxarxes públiques (amb ruta a l'Internet Gateway) i privades.", "Taules de rutes: cap a on va el tràfic de cada subxarxa.", "NAT Gateway: deixa sortir a Internet les subxarxes privades (es cobra per hora i per GB).", "Security Group: tallafocs amb estat, a nivell d'instància; NACL: sense estat, a nivell de subxarxa.", "VPC endpoints: accés privat a S3, DynamoDB i altres sense passar per Internet.", "Zones de disponibilitat (AZ): repartir subxarxes en 2 o 3."],
    useWhen: ["Sempre que hi hagi EC2, RDS o contenidors."],
    watch: ["El NAT Gateway és una de les sorpreses de factura més comunes.", "Les bases de dades van a subxarxes privades."],
    related: ["ec2", "rds", "elb"],
  },
  {
    slug: "route53", name: "Route 53", category: "Xarxa i lliurament", tagline: "DNS: converteix noms de domini en adreces.",
    what: "Servei DNS i de registre de dominis, amb comprovacions de salut i encaminament intel·ligent.",
    concepts: ["Zona hostejada: conjunt de registres d'un domini.", "Registres A/AAAA, CNAME i l'«alias» (apunta a CloudFront, ELB, S3 sense cost de consulta).", "Polítiques: ponderada, per latència, per geografia, failover."],
    useWhen: ["Posar un domini propi davant de qualsevol servei d'AWS."],
    watch: ["Un CNAME no es pot posar a l'arrel del domini; cal un alias."],
    related: ["cloudfront", "elb", "acm"],
  },
  {
    slug: "cloudfront", name: "CloudFront", category: "Xarxa i lliurament", tagline: "CDN: serveix contingut des d'un node a prop de l'usuari.",
    what: "Xarxa de distribució que guarda còpies (cau) a centenars d'ubicacions, redueix la latència i protegeix l'origen.",
    concepts: ["Distribució amb un o més orígens (S3, ALB, API Gateway…).", "Comportaments (behaviors): regles per ruta sobre cau i orígens.", "Origin Access Control: només CloudFront pot llegir el bucket S3.", "Invalidacions per esborrar el cau; millor versionar els noms de fitxer.", "Certificat HTTPS gratuït via ACM (a la regió us-east-1)."],
    useWhen: ["Webs estàtiques i SPAs, imatges, vídeo.", "Un únic domini que combina frontend (S3) i API."],
    watch: ["Els canvis triguen a propagar-se si no es versiona.", "El certificat per a CloudFront s'ha de crear a Virgínia (us-east-1)."],
    related: ["s3", "acm", "route53", "api-gateway"],
  },
  {
    slug: "elb", name: "Elastic Load Balancing", category: "Xarxa i lliurament", tagline: "Reparteix el tràfic entre diversos servidors sans.",
    what: "ALB treballa a nivell HTTP (ruta, host, capçaleres); NLB a nivell TCP/UDP amb moltíssima velocitat; GLB per a aparells de seguretat.",
    concepts: ["Target group: el conjunt de destinacions amb comprovació de salut.", "Regles de l'oient (listener): quina ruta va a quin grup.", "Terminació TLS al balancejador."],
    useWhen: ["Més d'una instància o tasca darrere d'una sola adreça."],
    watch: ["Un ALB té cost fix per hora; per a poc tràfic, API Gateway o Lambda URL surten més barats."],
    related: ["ec2", "ecs-fargate", "acm"],
  },
  {
    slug: "api-gateway", name: "API Gateway", category: "Integració", tagline: "Porta d'entrada HTTP per a les teves APIs.",
    what: "Exposa rutes (REST, HTTP o WebSocket) i les connecta a Lambda o a altres serveis, amb autenticació, límits i cau.",
    concepts: ["HTTP API: més simple i barata; REST API: més funcions (claus d'API, plans d'ús, validació).", "Autoritzadors: Cognito, JWT o una Lambda pròpia.", "Etapes (stages): dev, prod, amb variables pròpies.", "Límit de temps d'integració: 29 s (REST) / 30 s (HTTP)."],
    useWhen: ["API serverless amb Lambda al darrere."],
    watch: ["Es cobra per petició: amb molt tràfic pot sortir més car que un ALB.", "El límit de 30 s obliga a fer feines llargues de manera asíncrona."],
    related: ["lambda", "cloudfront", "cognito"],
  },
  {
    slug: "sqs", name: "SQS", category: "Integració", tagline: "Cues de missatges per desacoblar parts del sistema.",
    what: "Un productor deixa missatges a la cua i un consumidor els processa quan pot, absorbint els pics.",
    concepts: ["Estàndard (almenys un lliurament, ordre no garantit) o FIFO (ordre i sense duplicats).", "Visibility timeout: temps que un missatge queda amagat mentre algú el processa.", "Dead-letter queue: on van els missatges que fallen massa vegades.", "Lambda pot consumir-la directament."],
    useWhen: ["Feines en segon pla, protegir una base de dades dels pics."],
    watch: ["Cal fer el consumidor idempotent: un missatge es pot lliurar dues vegades."],
    related: ["sns", "lambda", "eventbridge"],
  },
  {
    slug: "sns", name: "SNS", category: "Integració", tagline: "Publicar un missatge i que arribi a molts subscriptors.",
    what: "Tema (topic) al qual es publica; els subscriptors (SQS, Lambda, correu, SMS, HTTP) reben una còpia.",
    concepts: ["Patró fan-out: SNS → diverses cues SQS.", "Filtres de subscripció per rebre només certs missatges."],
    useWhen: ["Avisos, notificacions, repartir un esdeveniment a diversos sistemes."],
    watch: ["No guarda els missatges: si ningú escolta, es perden (per això se sol combinar amb SQS)."],
    related: ["sqs", "eventbridge"],
  },
  {
    slug: "eventbridge", name: "EventBridge", category: "Integració", tagline: "Bus d'esdeveniments i planificador (cron) del núvol.",
    what: "Rep esdeveniments d'AWS i de les teves apps i els encamina segons regles; també llança tasques programades.",
    concepts: ["Bus d'esdeveniments, regles amb patrons, destinacions (Lambda, SQS, Step Functions…).", "Scheduler: cron o una sola execució en un moment concret."],
    useWhen: ["Executar una Lambda cada nit, reaccionar a canvis en altres serveis."],
    watch: ["Lliurament almenys una vegada: idempotència també aquí."],
    related: ["lambda", "sqs", "sns"],
  },
  {
    slug: "iam", name: "IAM", category: "Seguretat", tagline: "Qui pot fer què: la base de tota la seguretat d'AWS.",
    what: "Identity and Access Management defineix identitats i permisos. Tot el que fa un servei o persona passa per una política.",
    concepts: [
      "Usuari, grup i rol: els rols donen credencials temporals i són el camí preferit.",
      "Política: JSON amb Effect, Action, Resource i Condition; per defecte tot està denegat.",
      "Menor privilegi: només els permisos necessaris.",
      "Rol d'execució d'una Lambda; rol d'instància per a EC2.",
      "OIDC amb GitHub Actions: el desplegament s'autentica sense claus guardades.",
      "Compte arrel: protegir-lo amb MFA i no usar-lo per a la feina diària.",
    ],
    useWhen: ["Sempre."],
    watch: ["Les claus d'accés de llarga durada són un risc: millor rols.", "Un «Action: *» amb «Resource: *» és el contrari del menor privilegi."],
    related: ["kms", "secrets-ssm", "cognito"],
  },
  {
    slug: "cognito", name: "Cognito", category: "Seguretat", tagline: "Registre i inici de sessió d'usuaris de la teva aplicació.",
    what: "User Pools gestiona usuaris, contrasenyes, MFA i inici amb Google/Apple; Identity Pools dóna credencials AWS temporals.",
    concepts: ["Tokens JWT (ID, accés, refresc).", "Hosted UI i fluxos OAuth 2.0 / OIDC.", "Integració directa amb API Gateway com a autoritzador."],
    useWhen: ["Vols autenticació sense escriure-la (aquí s'ha fet pròpia, amb bcrypt i galeta)."],
    watch: ["Migrar-ne els usuaris després és feixuc; la personalització té límits."],
    related: ["iam", "api-gateway"],
  },
  {
    slug: "kms", name: "KMS", category: "Seguretat", tagline: "Claus de xifratge gestionades.",
    what: "Crea i custodia claus; AWS no et deixa extreure la clau mestra, només demanar-li que xifri o desxifri.",
    concepts: ["CMK/«clau KMS»: la clau mestra; xifratge d'envoltura (envelope): una clau de dades xifrada per la mestra.", "Polítiques de clau + IAM decideixen qui la pot usar.", "S3, EBS, RDS i Secrets Manager s'hi integren amb un clic."],
    useWhen: ["Xifrar dades en repòs amb control d'accés i traça d'auditoria."],
    watch: ["Cada ús es cobra una mica; esborrar una clau fa irrecuperables les dades."],
    related: ["s3", "secrets-ssm", "iam"],
  },
  {
    slug: "secrets-ssm", name: "Secrets Manager i Parameter Store", category: "Seguretat", tagline: "On guardar contrasenyes i configuració, fora del codi.",
    what: "Parameter Store (de Systems Manager) desa valors de configuració, també xifrats; Secrets Manager afegeix rotació automàtica de secrets.",
    concepts: ["Paràmetres «SecureString» xifrats amb KMS.", "Jerarquia de noms (/app/prod/db).", "Secrets Manager: rotació per a RDS i cost per secret."],
    useWhen: ["Cap secret al codi; l'aplicació els llegeix en arrencar amb el seu rol IAM."],
    watch: ["Parameter Store estàndard és gratuït; Secrets Manager cobra per secret i mes."],
    related: ["kms", "iam", "lambda"],
  },
  {
    slug: "acm", name: "ACM", category: "Seguretat", tagline: "Certificats HTTPS gratuïts i que es renoven sols.",
    what: "AWS Certificate Manager emet certificats TLS per usar a CloudFront, ELB i API Gateway.",
    concepts: ["Validació per DNS (un CNAME a Route 53).", "Un certificat és regional, excepte per a CloudFront (us-east-1)."],
    useWhen: ["Qualsevol domini propi amb HTTPS."],
    watch: ["No es poden exportar per posar-los en una EC2 pròpia."],
    related: ["cloudfront", "route53", "elb"],
  },
  {
    slug: "cloudwatch", name: "CloudWatch", category: "Operacions", tagline: "Registres, mètriques i alarmes.",
    what: "Recull els logs de Lambda i d'altres serveis, mostra mètriques i dispara alarmes.",
    concepts: ["Log groups i streams; Logs Insights per consultar-los amb un llenguatge propi.", "Mètriques estàndard i personalitzades; alarmes → SNS.", "Retenció configurable (per defecte, mai caduquen i es paga)."],
    useWhen: ["Depurar Lambda, vigilar errors i latència."],
    watch: ["Posa una retenció als grups de logs o creixeran sense límit."],
    related: ["lambda", "sns"],
  },
  {
    slug: "terraform-cfn", name: "CloudFormation i Terraform", category: "Operacions", tagline: "La infraestructura com a codi.",
    what: "En lloc de fer clic a la consola, descrius els recursos en fitxers versionats i l'eina els crea o els canvia. CloudFormation és d'AWS; Terraform és multi-núvol.",
    concepts: ["Estat: Terraform guarda què ha creat (a S3 amb bloqueig).", "plan abans d'apply: revisar els canvis.", "Mòduls per reutilitzar peces.", "Deriva (drift): quan algú canvia a mà el que el codi descriu."],
    useWhen: ["Sempre que l'entorn s'hagi de poder refer o repetir (dev i prod)."],
    watch: ["Mai guardar l'estat en local si hi treballa més d'una persona o un CI."],
    related: ["iam", "s3"],
  },
];

// Tots els serveis, per ordre alfabètic dins de cada categoria. Si un slug surt als dos llocs, guanyen els apunts.
const detailedSlugs = new Set(DETAILED.map((x) => x.slug));
export const SERVICES: Service[] = [...DETAILED, ...BRIEF.filter((b) => !detailedSlugs.has(b.slug))].sort((a, b) =>
  a.name.localeCompare(b.name, "ca"),
);

export const ARCHITECTURES: Architecture[] = [
  {
    slug: "web-estatica", name: "Web estàtica amb CDN", tagline: "La més simple i barata per a un lloc o una SPA.",
    flow: ["Usuari → Route 53 (domini)", "CloudFront (HTTPS amb ACM, cau)", "S3 (fitxers HTML, JS i CSS)"],
    why: "No hi ha servidors. S3 és barat i durable; CloudFront fa que sigui ràpid arreu i evita que el bucket sigui públic.",
    tradeoffs: ["Només contingut estàtic: per a dades cal una API.", "Cal invalidar el cau o versionar fitxers en desplegar."],
    services: ["route53", "cloudfront", "acm", "s3"],
  },
  {
    slug: "api-serverless", name: "API serverless", tagline: "SPA + Lambda + base de dades: el patró d'aquest lloc.",
    flow: ["Usuari → CloudFront", "/ → S3 (frontend)", "/api → API Gateway o Function URL → Lambda", "Lambda → base de dades (PostgreSQL) i SSM per als secrets"],
    why: "Només pagues quan hi ha ús, escala sola i no hi ha servidors per pegar. Un sol domini evita problemes de CORS.",
    tradeoffs: ["Arrencades en fred.", "Cal gestionar les connexions a la base de dades (pooler).", "Límit de temps per petició."],
    services: ["cloudfront", "s3", "api-gateway", "lambda", "secrets-ssm", "rds"],
  },
  {
    slug: "tres-capes", name: "Aplicació en tres capes", tagline: "Balancejador, servidors i base de dades, en diverses zones.",
    flow: ["Usuari → Route 53 → ALB (subxarxes públiques)", "Instàncies EC2 o tasques Fargate (subxarxes privades, en 2 AZ)", "RDS Multi-AZ (subxarxes privades)"],
    why: "Alta disponibilitat clàssica: si cau una zona, l'altra continua. Control total del programari.",
    tradeoffs: ["Cost fix (ALB, NAT, RDS) encara que no hi hagi ús.", "Més operació: pegats, escalat, imatges."],
    services: ["route53", "elb", "ec2", "ecs-fargate", "rds", "vpc"],
  },
  {
    slug: "event-driven", name: "Arquitectura guiada per esdeveniments", tagline: "Peces petites que reaccionen i no depenen les unes de les altres.",
    flow: ["Origen (API, S3, calendari) → EventBridge o SNS", "SQS (absorbeix pics, reintents, DLQ)", "Lambda processa", "DynamoDB o S3 desa el resultat"],
    why: "Cada part escala i falla per separat; afegir un consumidor nou no toca l'emissor.",
    tradeoffs: ["Més difícil de seguir i depurar (cal traçar).", "Consistència eventual i idempotència obligatòria."],
    services: ["eventbridge", "sns", "sqs", "lambda", "dynamodb"],
  },
  {
    slug: "xarxa-segura", name: "Xarxa privada segura", tagline: "Res de bases de dades a Internet.",
    flow: ["Internet → només ALB/CloudFront", "Subxarxes privades per a còmput i dades", "VPC endpoints cap a S3 i DynamoDB", "NAT només si cal sortir"],
    why: "Redueix la superfície d'atac: els serveis interns no tenen IP pública i es parlen amb Security Groups.",
    tradeoffs: ["NAT i endpoints tenen cost.", "Depurar la connectivitat és més treball."],
    services: ["vpc", "elb", "iam", "kms"],
  },
];

export const serviceBySlug = (slug: string) => SERVICES.find((s) => s.slug === slug);
export const architectureBySlug = (slug: string) => ARCHITECTURES.find((a) => a.slug === slug);
