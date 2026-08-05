export const JOURNEY_INTRO_STORAGE_KEY = "atlas-journey-intro:v2";
export const JOURNEY_INTRO_SEEN_VALUE = "seen";

export type JourneyAvailability = "available" | "coming-soon";
export type JourneyTransitionLabel = "平行回答" | "问题转向" | "概念重构" | "批判推进";

export type JourneyTransition =
  | {
      kind: "evidence-relation";
      relationId: string;
      label: string;
    }
  | {
      kind: "thematic-transition";
      from: string;
      to: string;
      label: JourneyTransitionLabel;
    };

export interface JourneyNode {
  id: string;
  thinkerId: string;
  eyebrow: string;
  title: string;
  coreIdea: string;
  body: string;
  transitionPrompt: string;
  durationMs: number;
  camera: { lat: number; lon: number; distance: number };
  incomingTransition?: JourneyTransition;
}

export interface JourneyDefinition {
  id: string;
  category: "philosophical-question" | "philosophical-tradition";
  availability: JourneyAvailability;
  recommended?: boolean;
  relatedJourneyId?: string;
  title: string;
  question: string;
  description: string;
  estimatedDurationMs: number;
  openingQuestion?: string;
  closingTitle?: string;
  closingBody?: string;
  nodes: JourneyNode[];
}

type JourneyCamera = JourneyNode["camera"];

const cameraByThinker: Record<string, JourneyCamera> = {
  "akshapada-gautama": { lat: 26.35, lon: 86.08, distance: 4.1 },
  aquinas: { lat: 48.86, lon: 2.35, distance: 4.0 },
  aristotle: { lat: 37.98, lon: 23.73, distance: 4.0 },
  augustine: { lat: 36.88, lon: 7.75, distance: 4.0 },
  avicenna: { lat: 39.77, lon: 64.46, distance: 4.0 },
  beauvoir: { lat: 48.86, lon: 2.34, distance: 3.95 },
  buddha: { lat: 24.7, lon: 84.99, distance: 4.0 },
  camus: { lat: 36.75, lon: 3.06, distance: 4.0 },
  "charles-w-mills": { lat: 40.71, lon: -74.0, distance: 4.0 },
  confucius: { lat: 35.6, lon: 116.99, distance: 4.0 },
  descartes: { lat: 52.37, lon: 4.9, distance: 4.0 },
  dignaga: { lat: 25.14, lon: 85.44, distance: 4.0 },
  "donna-haraway": { lat: 36.97, lon: -122.03, distance: 4.0 },
  epictetus: { lat: 39.0, lon: 20.75, distance: 4.0 },
  epicurus: { lat: 37.98, lon: 23.73, distance: 4.0 },
  fanon: { lat: 14.62, lon: -61.06, distance: 4.0 },
  "george-berkeley": { lat: 53.35, lon: -6.26, distance: 4.0 },
  heidegger: { lat: 48.01, lon: 7.85, distance: 3.9 },
  hobbes: { lat: 51.51, lon: -0.13, distance: 4.0 },
  hume: { lat: 55.95, lon: -3.19, distance: 3.95 },
  husserl: { lat: 48.0, lon: 7.84, distance: 3.9 },
  "jeremy-bentham": { lat: 51.51, lon: -0.13, distance: 4.0 },
  "john-rawls": { lat: 42.38, lon: -71.12, distance: 4.0 },
  kant: { lat: 54.71, lon: 20.51, distance: 3.9 },
  kierkegaard: { lat: 55.68, lon: 12.57, distance: 4.0 },
  locke: { lat: 51.52, lon: -0.1, distance: 3.95 },
  "martha-nussbaum": { lat: 41.88, lon: -87.63, distance: 4.0 },
  "merleau-ponty": { lat: 48.86, lon: 2.35, distance: 3.95 },
  mozi: { lat: 35.4, lon: 116.6, distance: 4.0 },
  nietzsche: { lat: 47.56, lon: 7.59, distance: 4.0 },
  parmenides: { lat: 40.16, lon: 15.16, distance: 4.0 },
  plato: { lat: 38.01, lon: 23.72, distance: 4.05 },
  protagoras: { lat: 37.98, lon: 23.73, distance: 4.0 },
  rousseau: { lat: 46.2, lon: 6.14, distance: 4.0 },
  sartre: { lat: 48.86, lon: 2.35, distance: 3.95 },
  spinoza: { lat: 52.07, lon: 4.3, distance: 4.0 },
  "thomas-kuhn": { lat: 40.35, lon: -74.66, distance: 4.0 },
  wittgenstein: { lat: 52.21, lon: 0.12, distance: 4.0 },
  wollstonecraft: { lat: 51.52, lon: -0.09, distance: 4.0 },
  zhuangzi: { lat: 34.45, lon: 115.65, distance: 4.0 },
};

function thematic(from: string, to: string, label: JourneyTransitionLabel): JourneyTransition {
  return { kind: "thematic-transition", from, to, label };
}

function evidence(relationId: string, label: string): JourneyTransition {
  return { kind: "evidence-relation", relationId, label };
}

function journeyNode(
  id: string,
  thinkerId: string,
  eyebrow: string,
  title: string,
  coreIdea: string,
  body: string,
  transitionPrompt: string,
  durationMs: number,
  incomingTransition?: JourneyTransition,
): JourneyNode {
  const camera = cameraByThinker[thinkerId];
  if (!camera) throw new Error(`Journey node ${id} has no camera for ${thinkerId}.`);
  return { id, thinkerId, eyebrow, title, coreIdea, body, transitionPrompt, durationMs, camera, incomingTransition };
}

const epistemologyNodes: JourneyNode[] = [
  {
    id: "plato-appearance-and-reason",
    thinkerId: "plato",
    eyebrow: "第一站 · 雅典",
    title: "眼前所见，可能只是表象",
    coreIdea: "眼前所见不断变化，知识必须追问表象背后稳定、可以说明的理由。",
    body: "柏拉图区分意见与知识：感官让我们看见变化，哲学则要求我们说明，为什么一个判断值得相信。",
    transitionPrompt: "如果感官不够可靠，我们究竟可以通过哪些方式获得知识？",
    durationMs: 9_000,
    camera: { lat: 38.01, lon: 23.72, distance: 4.05 },
  },
  {
    id: "nyaya-sources-of-knowledge",
    thinkerId: "akshapada-gautama",
    eyebrow: "第二站 · 南亚正理派",
    title: "把“知道”拆成不同渠道",
    coreIdea: "可靠认识可以来自知觉、推论、类比和可信证言，但每一种来源都需要辨别错误。",
    body: "《正理经》传统没有简单否定感官，而是分析不同知识来源何时可靠、何时会产生谬误。人物归属与年代仍有争议。",
    transitionPrompt: "即使分清了知识来源，如果这些来源都有可能骗人，还剩下什么确定的起点？",
    durationMs: 9_000,
    camera: { lat: 26.35, lon: 86.08, distance: 4.1 },
    incomingTransition: {
      kind: "thematic-transition",
      from: "plato",
      to: "akshapada-gautama",
      label: "平行回答",
    },
  },
  {
    id: "descartes-methodic-doubt",
    thinkerId: "descartes",
    eyebrow: "第三站 · 阿姆斯特丹",
    title: "把怀疑推到极限",
    coreIdea: "即使整个世界像一场梦，正在怀疑这件事本身仍证明思考者存在。",
    body: "笛卡尔把怀疑当作方法。他不是要永远否定世界，而是寻找一个无法再被怀疑的起点，重新建造知识。",
    transitionPrompt: "知识真的要从理性和自我确定性开始，还是一切观念都来自经验？",
    durationMs: 9_000,
    camera: { lat: 52.37, lon: 4.9, distance: 4.0 },
    incomingTransition: {
      kind: "thematic-transition",
      from: "akshapada-gautama",
      to: "descartes",
      label: "问题转向",
    },
  },
  {
    id: "locke-experience",
    thinkerId: "locke",
    eyebrow: "第四站 · 伦敦",
    title: "观念从经验中生长",
    coreIdea: "人并非带着现成观念出生；感觉和对内心活动的反省提供了观念的材料。",
    body: "洛克反对天赋观念，但“经验”不只是外部刺激，也包括我们对思考、怀疑和意愿等内心活动的反省。",
    transitionPrompt: "如果一切知识材料都来自经验，经验能够证明因果规律和未来吗？",
    durationMs: 9_000,
    camera: { lat: 51.52, lon: -0.1, distance: 3.95 },
    incomingTransition: {
      kind: "evidence-relation",
      relationId: "descartes-locke",
      label: "经验主义的反驳",
    },
  },
  {
    id: "hume-habit-and-causation",
    thinkerId: "hume",
    eyebrow: "第五站 · 爱丁堡",
    title: "经验主义反过来制造危机",
    coreIdea: "经验只告诉我们事情过去经常相随，却看不见必然因果；我们对未来的确信依赖习惯。",
    body: "我们见过无数次太阳升起，却不能仅凭过去在逻辑上保证明天。休谟让经验主义遇到了自己的边界。",
    transitionPrompt: "如果经验给不了必然性，科学知识为什么仍然可能？",
    durationMs: 11_000,
    camera: { lat: 55.95, lon: -3.19, distance: 3.95 },
    incomingTransition: {
      kind: "evidence-relation",
      relationId: "locke-hume",
      label: "经验主义的激进化",
    },
  },
  {
    id: "kant-conditions-of-experience",
    thinkerId: "kant",
    eyebrow: "第六站 · 柯尼斯堡",
    title: "心灵也参与塑造经验",
    coreIdea: "知识从经验开始，但经验之所以可以被理解，是因为心灵主动组织了它。",
    body: "康德改变了问题：时间、空间与因果等认识形式，不是从杂乱感觉中偶然捡到的，而是经验成为可理解经验的条件。",
    transitionPrompt: "除了人的认识结构，历史中的科学共同体会不会也影响什么算知识？",
    durationMs: 12_000,
    camera: { lat: 54.71, lon: 20.51, distance: 3.9 },
    incomingTransition: {
      kind: "evidence-relation",
      relationId: "hume-kant",
      label: "怀疑唤醒批判哲学",
    },
  },
  {
    id: "kuhn-paradigm",
    thinkerId: "thomas-kuhn",
    eyebrow: "第七站 · 普林斯顿",
    title: "知识也有共同体与历史",
    coreIdea: "科学并非只是在累积事实；共同的范式也会影响问题、证据和解释方式。",
    body: "库恩并不是说所有观点都一样可靠，而是提醒我们：科学判断发生在共同的方法、标准和历史框架之中。",
    transitionPrompt: "现在，把这条仍未结束的思想路径交给你。",
    durationMs: 10_000,
    camera: { lat: 40.35, lon: -74.66, distance: 4.0 },
    incomingTransition: {
      kind: "thematic-transition",
      from: "kant",
      to: "thomas-kuhn",
      label: "问题转向",
    },
  },
];

const freeWillNodes: JourneyNode[] = [
  journeyNode("epictetus-control", "epictetus", "第一站 · 尼科波利斯", "先分清什么由你决定", "自由首先不是控制世界，而是分清哪些判断与选择真正由自己负责。", "财富、名声和遭遇随时可能被夺走；我们仍能练习如何理解它们、如何回应。斯多亚式自由先把注意力从外部结果收回到判断。", "如果连“我必须控制自己”也成为一种执着，自由会不会还有另一种样子？", 9_000),
  journeyNode("zhuangzi-unfixed-freedom", "zhuangzi", "第二站 · 战国宋地", "不被一种立场困住", "松动对是非、得失和身份的固执，人才可能随着变化行动，而不被单一立场锁住。", "庄子没有提出近代意义的自由意志理论。他关心的是：当语言和成见把世界切成固定边界，人能否不再被这些边界支配。", "如果自由只是顺应变化，我们又如何为做错的事承担责任？", 9_000, thematic("epictetus", "zhuangzi", "平行回答")),
  journeyNode("augustine-divided-will", "augustine", "第三站 · 罗马属北非", "责任把意志推到中心", "人会明知某件事更好，却仍被另一种欲望拉走；意志的分裂使责任成为问题。", "奥古斯丁把恶与意志的误用联系起来，却也承认人不能只靠意志轻易治愈自己。自由从行动能力变成欲望、责任与恩典的纠缠。", "如果欲望本身也有原因，我们的选择会不会只是“不知道自己为何如此”？", 10_000, thematic("zhuangzi", "augustine", "问题转向")),
  journeyNode("spinoza-necessity", "spinoza", "第四站 · 海牙", "不知道原因，不等于自由", "人以为自己自由，是因为知道自己的欲望，却不知道欲望由哪些原因造成。", "斯宾诺莎没有把自由理解成逃出因果世界。越能理解身体、情感与环境怎样作用于自己，人越少被动地受它们摆布。", "如果自然中的一切都有原因，道德上的“我应该”还能要求我们自由吗？", 10_000, thematic("augustine", "spinoza", "概念重构")),
  journeyNode("kant-autonomy", "kant", "第五站 · 柯尼斯堡", "自由是给自己立法", "自由不是任性选择，而是理性主体能够不只服从欲望，还能依照自己认可的原则行动。", "作为自然中的对象，我们受到因果规律支配；作为需要承担责任的行动者，我们又必须把自己理解为能够自我立法。", "那个声称由理性决定的自我，会不会忽略身体、历史和权力塑造的欲望？", 10_000, thematic("spinoza", "kant", "问题转向")),
  journeyNode("nietzsche-who-wills", "nietzsche", "第六站 · 巴塞尔", "先问是谁在意志", "在宣布“这是我的自由选择”之前，还要追问：哪些驱力、价值和历史在借这个“我”说话？", "尼采怀疑一个透明、统一、完全自我掌控的主体。自由不再是凭空选择，而更像重估继承的价值并重新塑造自己的能力。", "如果人总在具体身体和社会中生活，自我塑造能否无视他人的自由？", 11_000, thematic("kant", "nietzsche", "批判推进")),
  journeyNode("beauvoir-situated-freedom", "beauvoir", "第七站 · 巴黎", "自由总在处境之中", "人无法选择自己的全部起点，却能在处境中回应它；真正的自由也不能建立在压迫他人之上。", "身体、性别、制度和他人的目光会限制可能性，但限制不等于命运。自由既是个人行动，也是让彼此拥有真实选择的共同任务。", "现在再看你的一个决定：哪些条件不是你选的，哪些回应仍需要由你承担？", 10_000, thematic("nietzsche", "beauvoir", "问题转向")),
];

const knowledgeWorldNodes: JourneyNode[] = [
  journeyNode("protagoras-human-measure", "protagoras", "第一站 · 雅典", "人是衡量事物的尺度", "世界总是向某个具体的人显现；判断不能完全脱离人的感受、处境与公共生活。", "我们主要通过柏拉图等人的转述了解普罗泰戈拉，因此不能把“人是尺度”简单缩成“什么都对”。它迫使哲学正视意见差异。", "不同视角冲突时，我们只能各说各话，还是能先看见立场怎样改变判断？", 9_000),
  journeyNode("zhuangzi-perspectives", "zhuangzi", "第二站 · 战国宋地", "换个位置，世界也会改变", "彼与此、是与非往往随着立场移动；承认视角有限，不等于放弃继续理解。", "庄子用辩论、寓言和视角转换松动自以为绝对的判断。问题不只是“谁正确”，还包括我们为何只能从这个位置看。", "如果视角不断变化，知觉与概念能否分工，让我们知道自己看到了什么？", 10_000, thematic("protagoras", "zhuangzi", "平行回答")),
  journeyNode("dignaga-perception-inference", "dignaga", "第三站 · 那烂陀", "知觉与概念不是一回事", "直接知觉面对具体呈现，推论和概念则通过区分与关系组织我们所理解的对象。", "陈那把认识分析为现量与比量。我们并非先得到一个已经贴好标签的世界；“这是什么”还包含概念化与推断的工作。", "如果我们接触的始终是经验内容，还需要假定经验背后的物质实体吗？", 10_000, thematic("zhuangzi", "dignaga", "概念重构")),
  journeyNode("berkeley-perceived-world", "george-berkeley", "第四站 · 都柏林", "别在感知背后再放一个世界", "颜色、声音、形状都是被感知的内容；用不可感知的物质实体解释它们，可能只是多加一层假设。", "贝克莱不是说“我不看，桌子就消失”。他以精神和上帝的持续知觉说明经验秩序，挑战的是独立物质实体的必要性。", "即使承认经验世界，我们用什么语言描述它，会不会改变什么能够被看见？", 10_000, thematic("dignaga", "george-berkeley", "问题转向")),
  journeyNode("wittgenstein-language-use", "wittgenstein", "第五站 · 剑桥", "世界通过语言变得可理解", "词语的意义不藏在对象背后，而在共同生活中的使用方式里形成。", "语言不是盖在纯粹世界上的标签。学习“疼痛”“规则”或“游戏”，也在学习何时能这样说、如何回应以及什么算作理由。", "共同语言帮助我们理解世界，但谁的位置会被当作默认、客观和普遍？", 11_000, thematic("george-berkeley", "wittgenstein", "概念重构")),
  journeyNode("haraway-situated-knowledge", "donna-haraway", "第六站 · 圣克鲁斯", "没有从任何地方看的目光", "可靠知识不是假装没有位置，而是说明自己从哪里看、能看见什么，又对哪些盲点负责。", "情境知识并不主张所有意见同样正确。可追责的局部视角，比自称无所不见的“上帝视角”更能接受检验。", "下次你说“事实就是这样”时，也问一句：是谁在看，使用什么工具？", 10_000, thematic("wittgenstein", "donna-haraway", "批判推进")),
];

const happinessNodes: JourneyNode[] = [
  journeyNode("confucius-relational-joy", "confucius", "第一站 · 曲阜", "快乐生长在日常关系里", "好生活不是独自获得一种感受，而是在学习、实践与待人中逐渐成为可信赖的人。", "仁与礼不是外加的表演，而是在家庭、朋友和公共关系中训练情感与判断。快乐可以来自德性的长期养成。", "如果幸福是一种经过练习的生活，怎样判断整个人生是否实现了人的能力？", 9_000),
  journeyNode("aristotle-flourishing", "aristotle", "第二站 · 雅典", "幸福是完整人生的活动", "幸福不是一阵心情，而是人在完整人生中持续运用德性、判断和行动能力。", "亚里士多德所说的幸福更接近蓬勃生活。品格重要，但友谊、共同体和一定的外部条件同样不能完全缺席。", "幸福需要整个人生，我们必须不断追求更多，还是先减少不必要的欲望？", 9_000, evidence("confucius-aristotle", "德性如何被培养")),
  journeyNode("epicurus-tranquility", "epicurus", "第三站 · 雅典花园", "快乐不等于无止境刺激", "稳定的快乐来自身体少受痛苦、心灵少受恐惧，而不是不断增加刺激和消费。", "伊壁鸠鲁区分自然且必要的欲望与被虚荣放大的欲望。简单生活、友爱和理解自然，反而更接近持久宁静。", "如果痛苦的根源不是欲望太多，而是我们执着于固定不变的自我呢？", 9_000, thematic("aristotle", "epicurus", "批判推进")),
  journeyNode("buddha-ending-suffering", "buddha", "第四站 · 菩提伽耶", "幸福要从理解痛苦开始", "痛苦与贪求、抗拒和无明相连；看清它们如何生起，才可能不再被它们反复推动。", "佛教道路不是把快乐感受无限放大，而是通过伦理、训练与洞见减少执取，使苦有可能止息。", "如果自由来自看清情感的成因，快乐是否也能成为行动能力的增长？", 10_000, thematic("epicurus", "buddha", "平行回答")),
  journeyNode("spinoza-joy-power", "spinoza", "第五站 · 海牙", "喜悦是行动能力的增加", "喜悦不只是舒服的感觉，而是一个人从较弱、较被动的状态转向更能理解和行动的状态。", "理解情感的因果关系，会使我们较少被外物牵引。幸福因此与更充分的观念、共同合作和主动生活联系起来。", "个人喜悦可以这样理解，公共制度又该如何比较许多人的快乐与痛苦？", 10_000, thematic("buddha", "spinoza", "平行回答")),
  journeyNode("bentham-public-utility", "jeremy-bentham", "第六站 · 伦敦", "让幸福成为制度尺度", "法律和政策不能只服务少数人的传统特权，应比较它给所有受影响者带来的快乐与痛苦。", "功利原则把幸福带入公共计算，让每个人的利益都算数。但把不同生活压缩成同一套快乐总量，也会遮蔽差异。", "如果一个人声称满意，却没有健康、教育或参与社会的机会，这算过得好吗？", 10_000, thematic("spinoza", "jeremy-bentham", "问题转向")),
  journeyNode("nussbaum-capabilities", "martha-nussbaum", "第七站 · 芝加哥", "幸福还要看真实机会", "评价生活不能只问“你感觉满意吗”，还要问一个人实际上能做什么、能成为什么。", "能力进路关注健康、教育、情感、参与和自主选择等真实机会。好生活具有多种形式，但尊严需要基本能力门槛。", "你追求的幸福，是短暂感觉、长期品格，还是选择不同生活的真实能力？", 11_000, thematic("jeremy-bentham", "martha-nussbaum", "批判推进")),
];

const justiceNodes: JourneyNode[] = [
  journeyNode("plato-justice-order", "plato", "第一站 · 雅典", "正义先被理解为秩序", "正义不仅是一次公平分配，也是一座城邦和一个灵魂的不同部分各尽其职、彼此协调。", "柏拉图把个人品格与政治秩序连在一起。这种整体观提供了宏大答案，也留下问题：谁来决定每个人适合的位置？", "与其先安排等级，能否用是否减少普遍伤害来检验制度？", 9_000),
  journeyNode("mozi-impartial-care", "mozi", "第二站 · 战国鲁地", "从所有人的利益检验正义", "制度若只维护亲族和强国的偏爱，就会制造争夺；兼爱要求把他人的利益也纳入行动标准。", "墨子以是否兴利除害检验政治与伦理，反对侵略和任人唯亲。正义由身份秩序转向可观察的公共后果。", "即使人们承认共同利益，彼此不信任时，谁来保证规则不被破坏？", 9_000, thematic("plato", "mozi", "平行回答")),
  journeyNode("hobbes-security", "hobbes", "第三站 · 伦敦", "没有安全，正义难以成立", "在没有共同权威的处境中，承诺随时可能失效；稳定规则首先需要能够执行它的公共力量。", "霍布斯从人的脆弱与相互戒惧出发。正义不是天然存在的秩序，而是在共同权威保障契约之后才获得现实条件。", "如果服从权威换来安全，人民是否仍能把法律称为自己的法律？", 10_000, thematic("mozi", "hobbes", "问题转向")),
  journeyNode("rousseau-common-freedom", "rousseau", "第四站 · 日内瓦", "正当法律应由共同自由产生", "自由的政治共同体不是把私人意志交给统治者，而是让公民共同形成面向公共利益的法律。", "卢梭以普遍意志说明服从共同制定的法律何以仍是自由。但“人民”内部是否真的平等，仍需继续追问。", "如果女性被排除在理性教育和公民身份之外，普遍意志究竟有多普遍？", 10_000, evidence("hobbes-rousseau", "自然状态的两种政治诊断")),
  journeyNode("wollstonecraft-inclusion", "wollstonecraft", "第五站 · 伦敦", "先问谁被允许成为公民", "女性被说成缺乏理性，并非自然事实；差异化教育先制造依赖，再把结果当成排除理由。", "沃斯通克拉夫特把启蒙的普遍原则反过来检验启蒙自身。正义不能只宣布人人平等，还要拆除制造不平等的制度。", "能否设计一种原则，让任何人都无法先替自己的阶层、性别或天赋谋利？", 10_000, evidence("rousseau-wollstonecraft", "谁被允许接受理性教育")),
  journeyNode("rawls-fair-choice", "john-rawls", "第六站 · 哈佛", "不知道自己是谁时选择规则", "如果不知道自己将出生在哪个阶层、拥有什么天赋，人们会更愿意选择保障平等自由和弱者的制度。", "无知之幕不是现实会议，而是检验偏私的思想实验。它把正义理解为公平选择的社会基本结构。", "如果真实制度本就建立在种族支配上，只讨论理想规则会不会看不见历史债务？", 11_000, thematic("wollstonecraft", "john-rawls", "概念重构")),
  journeyNode("mills-racial-contract", "charles-w-mills", "第七站 · 纽约", "理想规则可能遮住现实支配", "社会契约的普遍语言曾与种族排除同时存在；正义理论必须把真实的支配结构放回视野。", "种族契约揭示白人优势如何进入制度和知识规范。纠正不义不只是制定中立规则，也包括识别谁长期被规则当作例外。", "面对统一规则，除了问是否一样，也问它在怎样的历史起点上作用于谁。", 11_000, thematic("john-rawls", "charles-w-mills", "批判推进")),
];

const ontologyNodes: JourneyNode[] = [
  journeyNode("parmenides-being", "parmenides", "第一站 · 埃利亚", "不能从非存在开始", "能被思考和言说的探究必须沿着存在前进，因为非存在既不能被把握，也不能解释事物。", "巴门尼德把变化与多样性推入难题：如果某物从不存在变成存在，我们是否已经在谈论不可谈论的“无”？", "我们明明生活在变化的世界里，哲学怎样既承认存在，又解释生成？", 9_000),
  journeyNode("aristotle-many-senses-being", "aristotle", "第二站 · 雅典", "存在有多种说法", "存在不是一个与万物分离的单一东西；要从实体、性质、关系、形式与质料等方式理解事物。", "亚里士多德把问题拉回具体存在者。实体是重要中心，但潜能与现实、形式与质料共同解释事物如何保持自身又发生变化。", "具体事物是什么与它确实存在，是否还需要进一步区分？", 10_000, thematic("parmenides", "aristotle", "概念重构")),
  journeyNode("avicenna-essence-existence", "avicenna", "第三站 · 布哈拉", "本质不自动保证存在", "我们可以理解一匹马是什么，却不能仅从这个本质推出它现实存在；本质与存在需要区分。", "偶然事物的存在需要原因。阿维森纳由此追问因果链如何最终指向一个其存在并非偶然的必然存在者。", "如果受造物的本质与存在不同，存在本身如何使一个事物成为现实？", 11_000, evidence("aristotle-avicenna", "阅读、校验与重构")),
  journeyNode("aquinas-act-of-being", "aquinas", "第四站 · 巴黎", "存在不是再加上的性质", "具体事物不仅具有某种本质，还通过存在的行动成为现实；受造物的存在不是自足的。", "阿奎那吸收并重构亚里士多德和阿维森纳，把存在、本质、因果与神学组织进同一体系。存在不只是概念清单中的属性。", "如果不把世界理解成许多事物分享存在，而把一切看作同一现实的表达呢？", 10_000, evidence("avicenna-aquinas", "存在与本质的跨语言影响")),
  journeyNode("spinoza-one-substance", "spinoza", "第五站 · 海牙", "只有一个无限实体", "神或自然不是世界之外的创造者，而是唯一无限实体；具体事物是它以不同方式呈现的样态。", "心灵与身体不再是两种互不相干的实体，而是同一现实的不同属性。个体独立性的含义因此被彻底改写。", "这些理论都在解释哪些东西存在，但我们是否忘了问存在本身意味着什么？", 10_000, thematic("aquinas", "spinoza", "批判推进")),
  journeyNode("heidegger-being-question", "heidegger", "第六站 · 弗赖堡", "存在不等于任何存在者", "列出世界上所有事物，仍没有回答存在意味着什么；存在不能被当成最高或最大的一个东西。", "海德格尔把人的在世存在作为入口，因为我们总已在实践、关切和时间中理解事物。问题转向存在如何被理解。", "当你说某物存在，你是在指出一个东西，还是已默认某种理解世界的方式？", 11_000, thematic("spinoza", "heidegger", "问题转向")),
];

const existentialismNodes: JourneyNode[] = [
  journeyNode("kierkegaard-concrete-choice", "kierkegaard", "第一站 · 哥本哈根", "没有体系能替你生活", "关于人生的完整理论不能替具体个人选择；成为自己发生在焦虑、不确定和承诺之中。", "焦虑不只是疾病，它也揭示“我本可以做别的”。个体必须承担可能性，却无法等到所有风险都被知识消除。", "如果旧价值已经失去说服力，选择要依据什么，而不是只凭服从？", 9_000),
  journeyNode("nietzsche-revalue", "nietzsche", "第二站 · 巴塞尔", "成为自己也要重估价值", "人继承的善恶标准有其历史；成为自己需要追问这些价值服务了什么生命，又能否被重新创造。", "尼采通常被视为存在主义先驱而非该学派成员。他使问题从“我选什么”推进到“塑造这个我的价值从何而来”。", "价值重估仍容易想象一个站在世界外的个人；可人是否早已在世界之中？", 10_000, evidence("kierkegaard-nietzsche", "体系之外的个体与价值")),
  journeyNode("heidegger-being-in-world", "heidegger", "第三站 · 弗赖堡", "人首先是在世存在", "人不是先封闭在心里再观察世界；我们一开始就在工具、关系、关切和时间中生活。", "被抛处境不是自己选择的，但人仍要承接有限可能。本真不是自恋地与众不同，而是不再逃避自己的有限性。", "如果没有固定人性替我们决定行动，每一次选择是否都在定义我们是谁？", 11_000, thematic("nietzsche", "heidegger", "概念重构")),
  journeyNode("sartre-existence-precedes", "sartre", "第四站 · 巴黎", "存在先于本质", "人不是先拥有一份固定本质再去行动；我们先存在，并在选择中逐渐成为自己。", "萨特所谓自由不是“什么都做得到”。处境会限制行动，但我们仍要为如何理解和回应处境负责，不能把自己缩成固定角色。", "强调选择会不会高估个人，忽略性别、制度与他人的自由怎样限制可能？", 10_000, evidence("heidegger-sartre", "从在世存在到自由责任")),
  journeyNode("beauvoir-ambiguity", "beauvoir", "第五站 · 巴黎", "自由必须承认模糊处境", "我们既是能够超越现状的主体，也是受身体、历史和他人限制的存在；自由永远带着这种模糊性。", "波伏娃把存在主义从孤立选择推进到处境伦理。压迫会系统性缩小某些人的可能，自己的自由也需要他人的自由得到实现。", "如果殖民权力进入身体经验和自我形象，成为自己还需要怎样的解放？", 11_000, thematic("sartre", "beauvoir", "批判推进")),
  journeyNode("camus-absurd-revolt", "camus", "第六站 · 阿尔及尔—巴黎", "在荒诞中选择反抗", "世界不给终极答案，并不自动推出虚无；人仍能以清醒、反抗和共同限度回应生活。", "加缪拒绝用自杀或超越性信仰消除荒诞，也反对用未来正义替无限暴力开脱。他本人拒绝“存在主义者”标签，却直接参与了同期关于自由与责任的争论。", "如果殖民统治直接塑造身体和可能性，仅仅诉诸共同限度是否已经足够？", 11_000, thematic("beauvoir", "camus", "问题转向")),
  journeyNode("fanon-colonial-self", "fanon", "第七站 · 法兰西堡", "有些自我由压迫强行制造", "殖民与种族化不仅从外部限制人，还通过他人的目光、语言和制度塑造身体经验与自我关系。", "法农把存在问题推入殖民现实。摆脱被规定的身份不能只靠内心选择，还需要改变制造这种身份的物质与政治世界。", "成为自己包含选择，也包含识别哪些身份被强加、哪些可能需要共同争取。", 11_000, thematic("camus", "fanon", "批判推进")),
];

const phenomenologyNodes: JourneyNode[] = [
  journeyNode("descartes-first-person", "descartes", "第一站 · 阿姆斯特丹", "从第一人称确定性开始", "即使外部世界都可怀疑，正在怀疑和思考的经验仍不能被同时抹去。", "笛卡尔把第一人称意识推到哲学中心，却也留下心灵怎样抵达世界的困难。", "经验只是杂乱进入心灵的材料，还是心灵本身已在组织它？", 8_000),
  journeyNode("kant-structured-experience", "kant", "第二站 · 柯尼斯堡", "经验已被认识结构组织", "我们经验到的对象并非原样复制进心灵；时间、空间和范畴参与组织可理解的经验。", "康德仍在追问知识何以可能，却为后来现象学留下关键转向：研究对象，也要研究对象如何向我们呈现。", "能否暂时放下对外部世界的预设，直接描述经验如何出现？", 9_000, thematic("descartes", "kant", "概念重构")),
  journeyNode("husserl-intentionality", "husserl", "第三站 · 弗赖堡", "意识总是关于某物", "意识不是装满表象的盒子，它总朝向某个对象；现象学要描述这种意向关系。", "悬置不是否认世界存在，而是暂停未经检验的自然态度，把注意力转向对象如何在经验中获得意义。", "我们真是纯粹意识在观察对象，还是早已通过实践生活在世界中？", 10_000, thematic("kant", "husserl", "问题转向")),
  journeyNode("heidegger-lived-world", "heidegger", "第四站 · 弗赖堡", "经验首先是在世界中生活", "世界最先不是被观看的对象集合，而是我们已在使用、关心、躲避和共同生活的意义网络。", "锤子通常先作为用来做事的东西出现，坏掉后才突出成被观察对象。现象学由意识描述转向在世存在。", "在世存在不只是理解工具；身体本身是否就是我们通向世界的方式？", 10_000, evidence("husserl-heidegger", "现象学转向存在问题")),
  journeyNode("merleau-ponty-body-subject", "merleau-ponty", "第五站 · 巴黎", "身体不是物体，而是视角", "身体不是意识携带的一件物品，而是我们能够看、走、触碰并拥有一个世界的基本方式。", "知觉不是先收集感觉碎片再推理成世界。身体的习惯、姿势和行动可能性，已经把环境组织成可生活的场域。", "如果身体是经验的起点，社会会怎样赋予不同身体不同意义和可能？", 11_000, evidence("heidegger-merleau-ponty", "从在世存在到身体主体")),
  journeyNode("beauvoir-lived-body", "beauvoir", "第六站 · 巴黎", "身体经验也有社会处境", "身体既是主体生活世界的方式，也会在制度、习惯和他人的目光中被规定成某种身份。", "“女人不是天生的，而是成为的”并非否认身体，而是说明身体意义在生活处境中形成，并可能被重新改变。", "当目光不只区分性别，还把某种身体固定为种族对象，经验会发生什么？", 11_000, thematic("merleau-ponty", "beauvoir", "概念重构")),
  journeyNode("fanon-racialized-experience", "fanon", "第七站 · 法兰西堡", "被种族化的身体改变世界", "殖民目光会打断身体原本自然展开的行动，使人被迫从外部凝视并解释自己的身体。", "法农把现象学带入殖民经验：街道、语言和他人的目光不再是中性背景，而会直接改变身体能够如何进入世界。", "经验由身体展开，也可能被共同世界中的权力重新塑形。", 11_000, thematic("beauvoir", "fanon", "批判推进")),
];

export const epistemologyJourney: JourneyDefinition = {
  id: "epistemology",
  category: "philosophical-tradition",
  availability: "available",
  recommended: true,
  relatedJourneyId: "knowledge-world",
  title: "认识论",
  question: "你凭什么说“我知道”？",
  description: "从感官、推理和经验，走到心灵结构与科学共同体。",
  estimatedDurationMs: epistemologyNodes.reduce((total, node) => total + node.durationMs, 0),
  openingQuestion: "你确信明天太阳还会升起吗？过去每天如此，真的足以保证未来吗？",
  closingTitle: "这只是思想史中的一条路径",
  closingBody: "知识不是世界在头脑里留下的一张照片，而是经验、推理、心灵结构与共同检验共同形成的结果。继续探索不同思想之间的联系。",
  nodes: epistemologyNodes,
};

export const freeWillJourney: JourneyDefinition = {
  id: "free-will",
  category: "philosophical-question",
  availability: "available",
  relatedJourneyId: "justice",
  title: "自由意志",
  question: "如果一切都有原因，我还算自由吗？",
  description: "从内在控制、因果必然和自我立法，走向处境中的共同自由。",
  estimatedDurationMs: freeWillNodes.reduce((total, node) => total + node.durationMs, 0),
  openingQuestion: "性格来自经历，冲动来自身体，选择又受环境影响——一个决定究竟有多少真正属于你？",
  closingTitle: "自由不是一个神秘开关",
  closingBody: "自由也许是我们理解原因、承担行动并改变处境的不同方式。",
  nodes: freeWillNodes,
};

export const knowledgeWorldJourney: JourneyDefinition = {
  id: "knowledge-world",
  category: "philosophical-question",
  availability: "available",
  relatedJourneyId: "phenomenology",
  title: "认识世界",
  question: "我们看到的是世界本身吗？",
  description: "沿着尺度、视角、概念与语言，发现观察者从不真正缺席。",
  estimatedDurationMs: knowledgeWorldNodes.reduce((total, node) => total + node.durationMs, 0),
  openingQuestion: "同一场争吵，双方都确信自己看见了事实。我们看见的是世界，还是世界经过自身位置后的样子？",
  closingTitle: "没有未经中介的世界照片",
  closingBody: "世界并非任由我们想象，但它总要经过身体、概念、语言、工具和位置才向我们显现。",
  nodes: knowledgeWorldNodes,
};

export const happinessJourney: JourneyDefinition = {
  id: "happiness",
  category: "philosophical-question",
  availability: "available",
  relatedJourneyId: "ontology",
  title: "幸福",
  question: "什么才算真正过得好？",
  description: "从快乐感受走向品格、解脱、行动能力与真实生活机会。",
  estimatedDurationMs: happinessNodes.reduce((total, node) => total + node.durationMs, 0),
  openingQuestion: "如果今天非常快乐，却正在毁掉十年后的生活，这算幸福吗？",
  closingTitle: "幸福不只是一种感觉",
  closingBody: "它也关乎你正在成为怎样的人，以及你真正拥有怎样的生活。",
  nodes: happinessNodes,
};

export const justiceJourney: JourneyDefinition = {
  id: "justice",
  category: "philosophical-question",
  availability: "available",
  relatedJourneyId: "happiness",
  title: "正义",
  question: "公平是大家一样，还是纠正不平等？",
  description: "从秩序、安全和共同立法，走向被排除者与结构性支配。",
  estimatedDurationMs: justiceNodes.reduce((total, node) => total + node.durationMs, 0),
  openingQuestion: "把同样的规则交给所有人看似公平；但如果有人一开始就被挡在门外呢？",
  closingTitle: "正义也要检验秩序本身",
  closingBody: "谁参与制定规则，谁获得真实自由，又有哪些旧的不平等仍藏在中立背后？",
  nodes: justiceNodes,
};

export const ontologyJourney: JourneyDefinition = {
  id: "ontology",
  category: "philosophical-tradition",
  availability: "available",
  relatedJourneyId: "epistemology",
  title: "本体论",
  question: "当我们说“存在”，究竟在说什么？",
  description: "从实体、本质与存在，追问存在者背后那个最难解释的词。",
  estimatedDurationMs: ontologyNodes.reduce((total, node) => total + node.durationMs, 0),
  openingQuestion: "桌子、数字、梦、制度和“我”都可以说存在，但它们以同一种方式存在吗？",
  closingTitle: "有什么，与何谓存在",
  closingBody: "本体论不断改变的，正是我们提出这两个问题的方式。",
  nodes: ontologyNodes,
};

export const existentialismJourney: JourneyDefinition = {
  id: "existentialism",
  category: "philosophical-tradition",
  availability: "available",
  relatedJourneyId: "free-will",
  title: "存在主义",
  question: "人如何成为自己？",
  description: "从焦虑、选择与价值创造，走向身体、他人和历史处境。",
  estimatedDurationMs: existentialismNodes.reduce((total, node) => total + node.durationMs, 0),
  openingQuestion: "如果没有一份预先写好的人生说明书，你是谁，取决于身份还是选择？",
  closingTitle: "成为自己不是孤立的自我设计",
  closingBody: "自由始终与焦虑、身体、他人、制度和历史缠在一起。",
  nodes: existentialismNodes,
};

export const phenomenologyJourney: JourneyDefinition = {
  id: "phenomenology",
  category: "philosophical-tradition",
  availability: "available",
  relatedJourneyId: "existentialism",
  title: "现象学",
  question: "经验是怎样向我们显现的？",
  description: "从意识走向在世身体，看经验如何被社会处境重新塑形。",
  estimatedDurationMs: phenomenologyNodes.reduce((total, node) => total + node.durationMs, 0),
  openingQuestion: "疼痛不是一组神经数据，房间也不是坐标清单。生活经验为何总比客观描述多出一些东西？",
  closingTitle: "身体怎样拥有一个世界",
  closingBody: "现象学也发现：共同世界会以不同方式向不同身体开放或关闭。",
  nodes: phenomenologyNodes,
};

export const journeyCatalog: JourneyDefinition[] = [
  freeWillJourney,
  knowledgeWorldJourney,
  happinessJourney,
  justiceJourney,
  epistemologyJourney,
  ontologyJourney,
  existentialismJourney,
  phenomenologyJourney,
];

export const journeyById = new Map(journeyCatalog.map((journey) => [journey.id, journey]));

export function validateJourneyCatalog(catalog: JourneyDefinition[] = journeyCatalog) {
  const ids = catalog.map((journey) => journey.id);
  if (new Set(ids).size !== ids.length) throw new Error("Journey catalog contains duplicate ids.");
  if (catalog.filter((journey) => journey.recommended).length !== 1) {
    throw new Error("Journey catalog must contain exactly one recommended journey.");
  }
  for (const journey of catalog) {
    if (journey.availability === "available" && (journey.nodes.length < 5 || journey.nodes.length > 7)) {
      throw new Error(`Available journey ${journey.id} must contain five to seven nodes.`);
    }
    if (journey.relatedJourneyId && (!ids.includes(journey.relatedJourneyId) || journey.relatedJourneyId === journey.id)) {
      throw new Error(`Journey ${journey.id} has an invalid related journey.`);
    }
    const nodeIds = journey.nodes.map((node) => node.id);
    if (new Set(nodeIds).size !== nodeIds.length) throw new Error(`Journey ${journey.id} contains duplicate node ids.`);
    const estimatedDurationMs = journey.nodes.reduce((total, node) => total + node.durationMs, 0);
    if (estimatedDurationMs !== journey.estimatedDurationMs) throw new Error(`Journey ${journey.id} has a stale estimated duration.`);
    for (const node of journey.nodes) {
      if (node.durationMs <= 0) throw new Error(`Journey node ${node.id} has an invalid duration.`);
      const transition = node.incomingTransition;
      if (!transition) continue;
      if (transition.kind === "thematic-transition") {
        if (transition.from === transition.to) throw new Error(`Journey node ${node.id} has a self-referencing thematic transition.`);
      }
    }
  }
  return true;
}

validateJourneyCatalog();

export function validateJourneyReferences(
  catalog: JourneyDefinition[],
  thinkerIds: Set<string>,
  relationIds: Set<string>,
) {
  for (const journey of catalog) {
    for (const node of journey.nodes) {
      if (!thinkerIds.has(node.thinkerId)) throw new Error(`Journey node ${node.id} references missing thinker ${node.thinkerId}.`);
      const transition = node.incomingTransition;
      if (!transition) continue;
      if (transition.kind === "evidence-relation" && !relationIds.has(transition.relationId)) {
        throw new Error(`Journey node ${node.id} references missing relation ${transition.relationId}.`);
      }
      if (transition.kind === "thematic-transition") {
        if (!thinkerIds.has(transition.from) || !thinkerIds.has(transition.to)) {
          throw new Error(`Journey node ${node.id} has an invalid thematic transition.`);
        }
        if (relationIds.has(`${transition.from}-${transition.to}`)) {
          throw new Error(`Journey node ${node.id} duplicates an evidence relation as a thematic transition.`);
        }
      }
    }
  }
  return true;
}

export function formatJourneyRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `约剩${Math.max(1, seconds)}秒`;
  return `约剩${minutes}分${String(seconds).padStart(2, "0")}秒`;
}

export function formatJourneyDuration(milliseconds: number) {
  const roundedSeconds = Math.max(10, Math.round(milliseconds / 10_000) * 10);
  return `约${roundedSeconds}秒`;
}

export function journeyRemainingMs(journey: JourneyDefinition, nodeIndex: number) {
  return journey.nodes.slice(Math.max(0, nodeIndex)).reduce((total, node) => total + node.durationMs, 0);
}

export type JourneyEventName = "preview" | "start" | "pause" | "resume" | "skip" | "complete";

export function emitJourneyEvent(name: JourneyEventName, detail: Record<string, string | number> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("atlas:journey", { detail: { name, ...detail } }));
}
