// Necessitats de negoci o d'arquitectura → serveis que hi ajuden i per què. Els slugs són els de SERVICES.

export interface Need {
  slug: string;
  name: string;
  tagline: string;
  what: string;
  services: { slug: string; why: string }[];
}

export const NEEDS: Need[] = [
  {
    slug: "latencia", name: "Latència baixa", tagline: "Que cada petició es respongui en poc temps.",
    what: "La latència és el temps entre la petició i la resposta. Es redueix apropant el contingut a l'usuari, evitant feina al camí crític i posant dades a mitjans ràpids.",
    services: [
      { slug: "cloudfront", why: "Serveix contingut des de nodes propers a l'usuari i guarda còpies en cau." },
      { slug: "global-accelerator", why: "Entra a la xarxa d'AWS pel punt més proper i redueix salts per Internet." },
      { slug: "elasticache", why: "Cau en memòria: lectures en mil·lisegons sense tocar la base de dades." },
      { slug: "dax", why: "Cau en memòria davant de DynamoDB, amb latència de microsegons." },
      { slug: "dynamodb", why: "Lectures i escriptures d'un sol dígit de mil·lisegons a qualsevol escala." },
      { slug: "route53", why: "L'encaminament per latència envia cada usuari a la regió més ràpida." },
      { slug: "aurora", why: "Rèpliques de lectura prop de l'aplicació i emmagatzematge compartit ràpid." },
    ],
  },
  {
    slug: "alta-concurrencia", name: "Alta concurrència", tagline: "Moltes peticions simultànies sense degradar-se.",
    what: "Cal repartir la càrrega entre moltes unitats de còmput i evitar que un recurs compartit (normalment la base de dades) sigui el coll d'ampolla.",
    services: [
      { slug: "elb", why: "Reparteix les connexions entre moltes instàncies o tasques." },
      { slug: "lambda", why: "Escala creant còpies de la funció en paral·lel, fins al límit de concurrència." },
      { slug: "dynamodb", why: "Escala horitzontalment per partició, sense límit pràctic de connexions." },
      { slug: "elasticache", why: "Absorbeix lectures repetides i protegeix la base de dades." },
      { slug: "sqs", why: "Posa en cua la feina i la processa al ritme que el sistema pot." },
      { slug: "rds", why: "Rèpliques de lectura i RDS Proxy per agrupar connexions." },
      { slug: "api-gateway", why: "Limita i regula peticions (throttling) abans que arribin al backend." },
    ],
  },
  {
    slug: "pics-de-demanda", name: "Pics de demanda", tagline: "Suportar augments sobtats i tornar a baixar de cost.",
    what: "L'elasticitat consisteix a créixer ràpid quan puja la càrrega i reduir-se quan baixa, o absorbir el pic amb cues i caus perquè no calgui créixer.",
    services: [
      { slug: "auto-scaling", why: "Afegeix i retira instàncies EC2 segons mètriques o un calendari." },
      { slug: "lambda", why: "Escala sola de zero a milers d'execucions; només pagues l'ús." },
      { slug: "sqs", why: "Fa de coixí: els missatges esperen a la cua i es processen més tard." },
      { slug: "dynamodb", why: "El mode sota demanda s'adapta als pics sense aprovisionar res." },
      { slug: "cloudfront", why: "Desvia la major part de lectures al cau, lluny de l'origen." },
      { slug: "ecs-fargate", why: "Escala tasques de contenidor segons la càrrega sense gestionar servidors." },
      { slug: "service-quotas", why: "Cal revisar i ampliar els límits abans del pic previst." },
    ],
  },
  {
    slug: "rto-baix", name: "RTO baix", tagline: "Tornar a servir ràpidament després d'una caiguda.",
    what: "El RTO (Recovery Time Objective) és el temps màxim acceptable per recuperar el servei. Per tenir-lo baix, la capacitat ha d'estar ja preparada o poder-se crear de manera automàtica.",
    services: [
      { slug: "route53", why: "Comprovacions de salut i failover de DNS cap a una altra regió o zona." },
      { slug: "elb", why: "Treu del tràfic les instàncies caigudes i reparteix a les sanes." },
      { slug: "rds", why: "Multi-AZ fa failover automàtic cap a la rèplica en uns minuts." },
      { slug: "aurora", why: "Failover en pocs segons cap a una rèplica; Global Database per a regions." },
      { slug: "auto-scaling", why: "Reposa instàncies perdudes sense intervenció." },
      { slug: "global-accelerator", why: "Canvia d'endpoint en segons si una regió falla, sense esperar al DNS." },
      { slug: "resilience-hub", why: "Valida si l'arquitectura compleix el RTO fixat." },
    ],
  },
  {
    slug: "rpo-baix", name: "RPO baix", tagline: "Perdre el mínim de dades en una fallada.",
    what: "El RPO (Recovery Point Objective) és quanta feina recent pots permetre't perdre. Com més baix, més freqüent o síncrona ha de ser la còpia de les dades.",
    services: [
      { slug: "rds", why: "Còpies contínues i restauració a un instant concret (PITR); Multi-AZ replica de manera síncrona." },
      { slug: "aurora", why: "Emmagatzematge replicat en tres zones i Global Database amb RPO d'un segon aproximadament." },
      { slug: "dynamodb", why: "Còpia contínua (PITR) i taules globals amb replicació multi-regió." },
      { slug: "s3", why: "Versionat i replicació entre regions (CRR)." },
      { slug: "backup", why: "Polítiques de còpia centralitzades i freqüents per a molts serveis." },
      { slug: "dms", why: "Replicació contínua de canvis cap a una altra base de dades." },
    ],
  },
  {
    slug: "alta-disponibilitat", name: "Alta disponibilitat", tagline: "Que el servei continuï funcionant tot i les fallades.",
    what: "S'aconsegueix repartint la càrrega en diverses zones de disponibilitat (AZ) i eliminant punts únics de fallada.",
    services: [
      { slug: "elb", why: "Reparteix el tràfic entre AZ i descarta els destins no sans." },
      { slug: "auto-scaling", why: "Manté el nombre desitjat d'instàncies repartides entre AZ." },
      { slug: "rds", why: "Multi-AZ: rèplica síncrona en una altra zona amb failover automàtic." },
      { slug: "s3", why: "Durabilitat de 11 nous; les dades es repliquen en diverses AZ." },
      { slug: "dynamodb", why: "Replicat automàticament entre tres AZ." },
      { slug: "vpc", why: "Subxarxes en 2 o 3 AZ per distribuir els recursos." },
      { slug: "route53", why: "Comprovacions de salut i encaminament entre regions." },
    ],
  },
  {
    slug: "recuperacio-desastres", name: "Recuperació de desastres", tagline: "Sobreviure a la pèrdua d'una regió sencera.",
    what: "Hi ha estratègies de cost i velocitat creixents: còpia i restauració, llum pilot, espera calenta i actiu-actiu multi-regió.",
    services: [
      { slug: "backup", why: "Còpies entre regions i comptes, amb polítiques i bloqueig." },
      { slug: "s3", why: "Replicació entre regions de les dades i els artefactes." },
      { slug: "dynamodb", why: "Taules globals per treballar actiu-actiu en diverses regions." },
      { slug: "aurora", why: "Global Database: rèplica en una altra regió i promoció ràpida." },
      { slug: "route53", why: "Failover de DNS cap a la regió de recuperació." },
      { slug: "terraform-cfn", why: "Torna a crear tot l'entorn a la regió de recuperació amb codi." },
      { slug: "mgn", why: "Replica servidors cap a AWS i els arrenca en cas de desastre." },
    ],
  },
  {
    slug: "abast-global", name: "Usuaris arreu del món", tagline: "Bona experiència independentment d'on sigui l'usuari.",
    what: "Combina contingut distribuït, dades replicades i encaminament intel·ligent cap a la regió més adequada.",
    services: [
      { slug: "cloudfront", why: "Centenars de ubicacions de vora per servir contingut local." },
      { slug: "route53", why: "Encaminament per latència o geografia." },
      { slug: "global-accelerator", why: "IP fixes i entrada ràpida a la xarxa d'AWS." },
      { slug: "dynamodb", why: "Taules globals amb escriptura a diverses regions." },
      { slug: "s3", why: "Replicació entre regions i punts d'accés multi-regió." },
    ],
  },
  {
    slug: "cost-baix", name: "Cost mínim", tagline: "Pagar només pel que cal.",
    what: "Es redueix ajustant mides, pagant per ús, comprometent-se on la càrrega és estable i movent dades poc usades a classes més barates.",
    services: [
      { slug: "lambda", why: "Es paga per ús; amb poc tràfic pot costar quasi res." },
      { slug: "s3", why: "Classes (Intelligent-Tiering, Glacier) i regles de cicle de vida." },
      { slug: "glacier", why: "Arxiu a molt baix cost per a dades poc consultades." },
      { slug: "ec2", why: "Savings Plans per a càrregues estables i Spot per a feines tolerants." },
      { slug: "compute-optimizer", why: "Detecta recursos sobredimensionats." },
      { slug: "cost-explorer", why: "Analitza la despesa i posa alertes de pressupost." },
      { slug: "trusted-advisor", why: "Recomanacions de recursos ociosos i infrautilitzats." },
    ],
  },
  {
    slug: "xifratge", name: "Xifratge de dades", tagline: "Protegir les dades en repòs i en trànsit.",
    what: "En repòs es xifra amb claus gestionades; en trànsit, amb TLS. El punt crític és qui controla i audita l'ús de les claus.",
    services: [
      { slug: "kms", why: "Crea i custodia les claus; permet auditar cada ús." },
      { slug: "acm", why: "Certificats TLS gratuïts per xifrar el trànsit." },
      { slug: "secrets-ssm", why: "Guarda contrasenyes i secrets xifrats, fora del codi." },
      { slug: "s3", why: "Xifratge per defecte en repòs i política que obliga a TLS." },
      { slug: "cloudhsm", why: "Claus en maquinari dedicat si el compliment ho exigeix." },
      { slug: "macie", why: "Troba dades sensibles que no haurien d'estar a S3." },
    ],
  },
  {
    slug: "identitat-acces", name: "Control d'accés i identitat", tagline: "Que cadascú només faci el que li toca.",
    what: "Menor privilegi, credencials temporals i un únic lloc d'identitat per a persones i aplicacions.",
    services: [
      { slug: "iam", why: "Polítiques i rols amb credencials temporals; la base de tot." },
      { slug: "identity-center", why: "Inici de sessió únic i permisos per a molts comptes." },
      { slug: "cognito", why: "Usuaris finals de les teves aplicacions, amb MFA i identitat federada." },
      { slug: "organizations", why: "Polítiques de control de servei (SCP) per a tots els comptes." },
      { slug: "verified-permissions", why: "Autorització de granularitat fina dins l'aplicació." },
      { slug: "directory-service", why: "Active Directory gestionat per a entorns Windows." },
    ],
  },
  {
    slug: "proteccio-atacs", name: "Protecció contra atacs", tagline: "DDoS, bots, injeccions i intrusions.",
    what: "Cal defensa en capes: a la vora, a l'aplicació, a la xarxa i en la detecció d'activitat anòmala.",
    services: [
      { slug: "shield", why: "Mitigació de DDoS (Standard inclòs; Advanced per a més protecció)." },
      { slug: "waf", why: "Regles contra SQL injection, XSS, bots i límits per IP." },
      { slug: "cloudfront", why: "Absorbeix tràfic a la vora, abans que arribi a l'origen." },
      { slug: "network-firewall", why: "Inspecció i filtratge de tràfic dins la VPC." },
      { slug: "guardduty", why: "Detecta activitat sospitosa analitzant registres." },
      { slug: "inspector", why: "Cerca vulnerabilitats conegudes als recursos." },
    ],
  },
  {
    slug: "compliment-auditoria", name: "Compliment i auditoria", tagline: "Demostrar qui ha fet què i que es compleixen les normes.",
    what: "Cal registrar l'activitat, comprovar la configuració contra regles i poder aportar proves.",
    services: [
      { slug: "cloudtrail", why: "Registre de totes les crides a l'API: qui, què i quan." },
      { slug: "config", why: "Historial de configuració i regles de compliment." },
      { slug: "audit-manager", why: "Recull proves per a auditories de manera contínua." },
      { slug: "artifact", why: "Informes i certificacions de compliment d'AWS." },
      { slug: "security-hub", why: "Vista consolidada de la postura de seguretat." },
      { slug: "control-tower", why: "Barreres de protecció (guardrails) en un entorn multicompte." },
    ],
  },
  {
    slug: "temps-real", name: "Processament en temps real", tagline: "Reaccionar a les dades a mesura que arriben.",
    what: "Dades en streaming: capturar-les en continu, processar-les en finestres i lliurar-les als consumidors amb retard mínim.",
    services: [
      { slug: "kinesis", why: "Captura i processa fluxos de dades en temps real." },
      { slug: "msk", why: "Kafka gestionat si ja l'uses o necessites el seu ecosistema." },
      { slug: "managed-flink", why: "Càlculs sobre el flux (finestres, agregacions) amb Flink." },
      { slug: "lambda", why: "Processa cada esdeveniment o lot en arribar." },
      { slug: "dynamodb", why: "Streams: flux de canvis cap a altres consumidors." },
      { slug: "opensearch", why: "Indexa i consulta registres i esdeveniments gairebé a l'instant." },
    ],
  },
  {
    slug: "desacoblament", name: "Desacoblament i fiabilitat", tagline: "Que una part pugui fallar sense endur-se les altres.",
    what: "Comunicació asíncrona amb missatges i esdeveniments, reintents i cues de missatges morts.",
    services: [
      { slug: "sqs", why: "Cua durable que absorbeix pics i permet reintents." },
      { slug: "sns", why: "Reparteix un esdeveniment a molts subscriptors (fan-out)." },
      { slug: "eventbridge", why: "Encamina esdeveniments segons regles, entre serveis i aplicacions." },
      { slug: "step-functions", why: "Orquestra passos amb reintents i gestió d'errors." },
      { slug: "mq", why: "Missatgeria estàndard (RabbitMQ, ActiveMQ) per a aplicacions existents." },
    ],
  },
  {
    slug: "lectures-rapides", name: "Alt rendiment de lectura", tagline: "Moltes lectures per segon i poc cost per lectura.",
    what: "Es resol amb caus en memòria, rèpliques de lectura i dades modelades per a la consulta.",
    services: [
      { slug: "elasticache", why: "Redis o Valkey en memòria per a resultats que es repeteixen." },
      { slug: "dax", why: "Cau transparent per a DynamoDB." },
      { slug: "rds", why: "Rèpliques de lectura per repartir consultes." },
      { slug: "aurora", why: "Fins a 15 rèpliques de lectura sobre el mateix emmagatzematge." },
      { slug: "cloudfront", why: "Cau de lectures HTTP a la vora." },
      { slug: "memorydb", why: "Base de dades en memòria amb durabilitat." },
    ],
  },
  {
    slug: "analisi-dades", name: "Anàlisi de grans volums de dades", tagline: "Convertir molta informació en respostes.",
    what: "Llac de dades a S3, catàleg i transformació, i un motor de consulta adequat a cada cas.",
    services: [
      { slug: "s3", why: "El llac de dades: barat, durable i obert a moltes eines." },
      { slug: "glue", why: "Catàleg i feines ETL sense servidors." },
      { slug: "athena", why: "SQL directament sobre S3, es paga per dada escanejada." },
      { slug: "redshift", why: "Magatzem de dades per a anàlisi SQL massiva i concurrent." },
      { slug: "emr", why: "Spark i Hadoop per a processament pesat i flexible." },
      { slug: "quicksight", why: "Quadres de comandament sobre les dades." },
      { slug: "lake-formation", why: "Governança i permisos del llac de dades." },
    ],
  },
  {
    slug: "migracio", name: "Migració cap a AWS", tagline: "Moure aplicacions i dades des d'un altre lloc.",
    what: "Descobrir, planificar i moure servidors, bases de dades i fitxers amb el mínim d'aturada.",
    services: [
      { slug: "mgn", why: "Replica servidors i els converteix a EC2 amb poc temps d'aturada." },
      { slug: "dms", why: "Migra bases de dades i mantén la replicació fins al canvi." },
      { slug: "datasync", why: "Copia grans volums de fitxers en xarxa." },
      { slug: "snow", why: "Aparells físics quan la xarxa és massa lenta per moure petabytes." },
      { slug: "migration-hub", why: "Seguiment de la migració des d'un sol lloc." },
      { slug: "transfer-family", why: "Mantenir fluxos SFTP existents cap a S3." },
    ],
  },
  {
    slug: "connectivitat-hibrida", name: "Connectivitat híbrida", tagline: "Unir el centre de dades propi amb AWS.",
    what: "Connexions privades i estables entre xarxes, i serveis que integren el món local amb el núvol.",
    services: [
      { slug: "direct-connect", why: "Enllaç dedicat amb latència i ample de banda previsibles." },
      { slug: "vpn", why: "Túnels xifrats ràpids de posar en marxa sobre Internet." },
      { slug: "transit-gateway", why: "Nus central per a moltes VPC i xarxes locals." },
      { slug: "storage-gateway", why: "Fa servir S3 com a emmagatzematge des d'aplicacions locals." },
      { slug: "outposts", why: "Infraestructura d'AWS dins el teu propi centre de dades." },
    ],
  },
  {
    slug: "observabilitat", name: "Observabilitat i monitoratge", tagline: "Saber què passa al sistema i per què.",
    what: "Mètriques, registres i traces per detectar problemes i trobar-ne la causa.",
    services: [
      { slug: "cloudwatch", why: "Mètriques, logs i alarmes de tots els serveis." },
      { slug: "xray", why: "Traça una petició a través de diversos serveis." },
      { slug: "managed-grafana", why: "Tauler de visualització sobre mètriques i registres." },
      { slug: "managed-prometheus", why: "Mètriques de contenidors i Kubernetes." },
      { slug: "cloudtrail", why: "Auditoria de qui ha canviat què." },
      { slug: "opensearch", why: "Cerca i anàlisi de grans volums de logs." },
    ],
  },
  {
    slug: "automatitzacio", name: "Automatització i infraestructura com a codi", tagline: "Desplegar de manera repetible i sense passos manuals.",
    what: "Tot descrit en codi, versionat i desplegat per una canalització amb proves.",
    services: [
      { slug: "terraform-cfn", why: "Defineix la infraestructura en fitxers revisables." },
      { slug: "cdk", why: "Infraestructura amb llenguatges de programació reals." },
      { slug: "codepipeline", why: "Canalització de lliurament continu." },
      { slug: "codebuild", why: "Compila i prova sense servidors de CI." },
      { slug: "codedeploy", why: "Desplegaments graduals i amb retrocés automàtic." },
      { slug: "systems-manager", why: "Automatitza tasques operatives i pegats a gran escala." },
    ],
  },
  {
    slug: "arxivat", name: "Arxivat i retenció a llarg termini", tagline: "Guardar durant anys a un cost baix.",
    what: "Classes d'emmagatzematge fredes, regles de cicle de vida i bloquejos per evitar esborrats.",
    services: [
      { slug: "glacier", why: "Arxiu a cost mínim amb recuperació de minuts a hores." },
      { slug: "s3", why: "Regles de cicle de vida i Object Lock (WORM) per retenció legal." },
      { slug: "backup", why: "Retenció de còpies amb bòveda protegida." },
      { slug: "snow", why: "Moure arxius enormes cap al núvol." },
    ],
  },
  {
    slug: "serverless", name: "No gestionar servidors", tagline: "Centrar-se en el codi, no en la infraestructura.",
    what: "Serveis que escalen sols, es paguen per ús i no tenen màquines a pegar.",
    services: [
      { slug: "lambda", why: "Executa codi sota demanda." },
      { slug: "api-gateway", why: "API HTTP sense servidors." },
      { slug: "dynamodb", why: "Base de dades sense servidors." },
      { slug: "s3", why: "Emmagatzematge sense capacitat a planificar." },
      { slug: "ecs-fargate", why: "Contenidors sense administrar instàncies." },
      { slug: "step-functions", why: "Fluxos de treball sense servidors." },
      { slug: "app-runner", why: "Posa en marxa un contenidor web amb una sola configuració." },
    ],
  },
  {
    slug: "aillament-xarxa", name: "Aïllament i segmentació de xarxa", tagline: "Limitar qui pot parlar amb qui.",
    what: "Xarxes privades, regles per capes i connexions que no passen per Internet.",
    services: [
      { slug: "vpc", why: "Xarxa privada amb subxarxes públiques i privades." },
      { slug: "privatelink", why: "Accés privat a serveis sense sortir a Internet." },
      { slug: "network-firewall", why: "Filtratge detallat del tràfic entre segments." },
      { slug: "vpc-lattice", why: "Connexió i política entre serveis de diverses VPC." },
      { slug: "transit-gateway", why: "Connexió controlada entre moltes xarxes." },
    ],
  },
  {
    slug: "orquestracio", name: "Orquestració de fluxos de treball", tagline: "Coordinar tasques amb ordre, condicions i reintents.",
    what: "Un coordinador central decideix quin pas va després i què fer si falla.",
    services: [
      { slug: "step-functions", why: "Màquines d'estats visuals amb reintents i paral·lelisme." },
      { slug: "eventbridge", why: "Desencadena fluxos amb esdeveniments o horaris." },
      { slug: "lambda", why: "Executa cada pas." },
      { slug: "batch", why: "Feines per lots pesades dins del flux." },
      { slug: "sqs", why: "Desacobla passos amb cues." },
    ],
  },
  {
    slug: "ia-generativa", name: "IA generativa i aprenentatge automàtic", tagline: "Afegir models i assistents a les aplicacions.",
    what: "Accedir a models fundacionals, entrenar-ne de propis i connectar-los amb les teves dades.",
    services: [
      { slug: "bedrock", why: "Models fundacionals (Claude i d'altres) amb una sola API." },
      { slug: "sagemaker", why: "Entrenar, ajustar i desplegar models propis." },
      { slug: "kendra", why: "Cerca intel·ligent sobre documents de l'empresa." },
      { slug: "textract", why: "Extreu dades de documents escanejats." },
      { slug: "transcribe", why: "Converteix veu en text." },
    ],
  },
  {
    slug: "resiliencia-provada", name: "Resiliència provada", tagline: "Comprovar que l'arquitectura aguanta, no només suposar-ho.",
    what: "Experiments controlats de caos, revisions d'arquitectura i proves de recuperació periòdiques.",
    services: [
      { slug: "fis", why: "Injecta fallades controlades per veure la reacció real." },
      { slug: "resilience-hub", why: "Avalua l'arquitectura contra els objectius RTO i RPO." },
      { slug: "well-architected", why: "Revisió amb els pilars de fiabilitat i seguretat." },
      { slug: "backup", why: "Prova de restauració de les còpies." },
    ],
  },
];

export const needBySlug = (slug: string) => NEEDS.find((n) => n.slug === slug);
export const needsForService = (slug: string) => NEEDS.filter((n) => n.services.some((s) => s.slug === slug));
