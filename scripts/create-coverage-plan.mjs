import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const groups = {
  "东亚": [
    "老子|Laozi|道家|公元前500年以前", "墨子|Mozi|墨家|公元前500年至公元500年", "孟子|Mencius|儒家|公元前500年至公元500年", "荀子|Xunzi|儒家|公元前500年至公元500年", "韩非|Han Fei|法家|公元前500年至公元500年", "董仲舒|Dong Zhongshu|汉代儒学|公元前500年至公元500年", "王充|Wang Chong|汉代批判思想|公元前500年至公元500年", "郭象|Guo Xiang|玄学|公元前500年至公元500年", "慧远|Huiyuan|中国佛教|公元前500年至公元500年", "智顗|Zhiyi|天台宗|500–1500年", "法藏|Fazang|华严宗|500–1500年", "韩愈|Han Yu|儒学复兴|500–1500年", "朱熹|Zhu Xi|理学|500–1500年", "陆九渊|Lu Jiuyuan|心学|500–1500年", "王阳明|Wang Yangming|心学|1500–1800年", "李贽|Li Zhi|明代批判思想|1500–1800年", "王夫之|Wang Fuzhi|明清之际思想|1500–1800年", "戴震|Dai Zhen|清代考据与哲学|1500–1800年", "康有为|Kang Youwei|近代经学与改革|1800–1945年", "梁启超|Liang Qichao|近代政治思想|1800–1945年", "孙中山|Sun Yat-sen|近代政治思想|1800–1945年", "胡适|Hu Shi|中国实用主义|1800–1945年", "梁漱溟|Liang Shuming|现代新儒家|1800–1945年", "冯友兰|Feng Youlan|现代中国哲学|1800–1945年", "牟宗三|Mou Zongsan|现代新儒家|1945年至今", "西田几多郎|Nishida Kitaro|京都学派|1800–1945年", "和辻哲郎|Watsuji Tetsuro|日本伦理学|1800–1945年", "道元|Dogen|日本禅宗|500–1500年", "空海|Kukai|日本密教|500–1500年", "荻生徂徕|Ogyu Sorai|日本古学|1500–1800年", "伊藤仁斋|Ito Jinsai|日本古学|1500–1800年", "李滉|Yi Hwang|朝鲜性理学|1500–1800年", "丁若镛|Jeong Yak-yong|朝鲜实学|1500–1800年"
  ],
  "南亚": [
    "筏驮摩那|Mahavira|耆那教|公元前500年以前", "耶若婆佉|Yajnavalkya|奥义书传统|公元前500年以前", "迦尔吉|Gargi Vachaknavi|奥义书传统|公元前500年以前", "弥勒依|Maitreyi|奥义书传统|公元前500年以前", "迦毗罗|Kapila|数论|公元前500年以前", "钵颠阇利|Patanjali|瑜伽哲学|公元前500年至公元500年", "迦那陀|Kanada|胜论|公元前500年以前", "乔达摩|Akshapada Gautama|正理派|公元前500年至公元500年", "阇弥尼|Jaimini|弥曼差|公元前500年至公元500年", "跋陀罗衍那|Badarayana|吠檀多|公元前500年至公元500年", "马鸣|Ashvaghosha|佛教哲学|公元前500年至公元500年", "世亲|Vasubandhu|瑜伽行派|公元前500年至公元500年", "无著|Asanga|瑜伽行派|公元前500年至公元500年", "陈那|Dignaga|佛教逻辑学|公元前500年至公元500年", "法称|Dharmakirti|佛教认识论|500–1500年", "商羯罗|Shankara|不二论吠檀多|500–1500年", "罗摩奴阇|Ramanuja|限定不二论|500–1500年", "摩陀婆|Madhva|二元论吠檀多|500–1500年", "阿毗那婆笈多|Abhinavagupta|克什米尔湿婆教|500–1500年", "伐致呵利|Bhartrhari|语言哲学|公元前500年至公元500年", "鸠摩梨罗|Kumarila Bhatta|弥曼差|500–1500年", "阇衍多|Jayanta Bhatta|正理派|500–1500年", "优陀延那|Udayana|正理—胜论|500–1500年", "恒伽沙|Gangesha|新正理派|500–1500年", "迦比尔|Kabir|虔信运动|500–1500年", "古鲁那纳克|Guru Nanak|锡克思想|1500–1800年", "罗姆摩罕·罗伊|Rammohan Roy|近代印度改革思想|1800–1945年", "维韦卡南达|Swami Vivekananda|现代吠檀多|1800–1945年", "泰戈尔|Rabindranath Tagore|现代印度人文思想|1800–1945年", "甘地|Mahatma Gandhi|非暴力政治哲学|1800–1945年", "安贝德卡尔|B. R. Ambedkar|反种姓与宪政思想|1800–1945年", "奥罗宾多|Sri Aurobindo|现代印度哲学|1800–1945年", "克里希那穆提|Jiddu Krishnamurti|现代精神哲学|1945年至今"
  ],
  "西亚、中亚及伊斯兰思想世界": [
    "琐罗亚斯德|Zoroaster|祆教思想|公元前500年以前", "摩尼|Mani|摩尼教|公元前500年至公元500年", "肯迪|Al-Kindi|阿拉伯语哲学|500–1500年", "法拉比|Al-Farabi|阿拉伯语哲学|500–1500年", "拉齐|Abu Bakr al-Razi|伊斯兰世界自然哲学|500–1500年", "安萨里|Al-Ghazali|伊斯兰神学与哲学|500–1500年", "伊本·鲁世德|Ibn Rushd|安达卢斯哲学|500–1500年", "苏哈拉瓦迪|Suhrawardi|照明哲学|500–1500年", "伊本·阿拉比|Ibn Arabi|苏菲形而上学|500–1500年", "穆拉·萨德拉|Mulla Sadra|伊斯兰后古典哲学|1500–1800年", "纳西尔丁·图西|Nasir al-Din Tusi|伊斯兰哲学与科学|500–1500年", "比鲁尼|Al-Biruni|比较思想与科学|500–1500年", "伊本·赫勒敦|Ibn Khaldun|历史与社会思想|500–1500年", "拉比娅·阿达维娅|Rabia al-Adawiyya|苏菲思想|500–1500年", "萨阿迪亚·高昂|Saadia Gaon|犹太哲学|500–1500年", "迈蒙尼德|Maimonides|犹太哲学|500–1500年", "斐洛|Philo of Alexandria|希腊化犹太哲学|公元前500年至公元500年", "犹大·哈列维|Judah Halevi|犹太哲学|500–1500年", "格尔松尼德|Gersonides|犹太哲学|500–1500年", "摩西·门德尔松|Moses Mendelssohn|犹太启蒙思想|1500–1800年", "巴哈欧拉|Bahaullah|巴哈伊思想|1800–1945年", "穆罕默德·伊克巴尔|Muhammad Iqbal|现代伊斯兰哲学|1800–1945年", "阿里·沙里亚蒂|Ali Shariati|现代伊朗政治思想|1945年至今", "阿卜杜勒卡里姆·索鲁什|Abdolkarim Soroush|当代伊斯兰思想|1945年至今", "法蒂玛·梅尔尼西|Fatema Mernissi|伊斯兰女性主义|1945年至今", "莱拉·艾哈迈德|Leila Ahmed|伊斯兰女性主义|1945年至今", "法兹鲁尔·拉赫曼|Fazlur Rahman|现代伊斯兰思想|1945年至今", "阿米娜·瓦杜德|Amina Wadud|伊斯兰女性主义|1945年至今", "塔拉勒·阿萨德|Talal Asad|宗教与世俗批判|1945年至今", "赛义德·侯赛因·纳斯尔|Seyyed Hossein Nasr|当代伊斯兰哲学|1945年至今"
  ],
  "欧洲与地中海": [
    "泰勒斯|Thales|前苏格拉底哲学|公元前500年以前", "阿那克西曼德|Anaximander|前苏格拉底哲学|公元前500年以前", "毕达哥拉斯|Pythagoras|前苏格拉底哲学|公元前500年以前", "赫拉克利特|Heraclitus|前苏格拉底哲学|公元前500年以前", "巴门尼德|Parmenides|前苏格拉底哲学|公元前500年以前", "恩培多克勒|Empedocles|前苏格拉底哲学|公元前500年以前", "德谟克利特|Democritus|原子论|公元前500年以前", "普罗泰戈拉|Protagoras|智者学派|公元前500年至公元500年", "狄奥提玛|Diotima of Mantinea|古希腊思想史候选|公元前500年至公元500年", "伊壁鸠鲁|Epicurus|伊壁鸠鲁学派|公元前500年至公元500年", "芝诺|Zeno of Citium|斯多亚学派|公元前500年至公元500年", "克律西波|Chrysippus|斯多亚学派|公元前500年至公元500年", "西塞罗|Cicero|罗马哲学|公元前500年至公元500年", "塞涅卡|Seneca|斯多亚学派|公元前500年至公元500年", "爱比克泰德|Epictetus|斯多亚学派|公元前500年至公元500年", "马可·奥勒留|Marcus Aurelius|斯多亚学派|公元前500年至公元500年", "普罗提诺|Plotinus|新柏拉图主义|公元前500年至公元500年", "希帕提娅|Hypatia|晚期古代哲学|公元前500年至公元500年", "波爱修斯|Boethius|晚期古代与中世纪哲学|公元前500年至公元500年", "安瑟伦|Anselm of Canterbury|经院哲学|500–1500年", "阿伯拉尔|Peter Abelard|经院哲学|500–1500年", "宾根的希尔德加德|Hildegard of Bingen|中世纪思想|500–1500年", "邓斯·司各脱|John Duns Scotus|经院哲学|500–1500年", "奥卡姆|William of Ockham|经院哲学|500–1500年", "艾克哈特|Meister Eckhart|中世纪神秘哲学|500–1500年", "克里斯蒂娜·德·皮桑|Christine de Pizan|中世纪政治思想|500–1500年", "伊拉斯谟|Erasmus|文艺复兴人文主义|1500–1800年", "弗朗西斯·培根|Francis Bacon|近代知识论|1500–1800年", "帕斯卡|Blaise Pascal|近代宗教哲学|1500–1800年", "莱布尼茨|G. W. Leibniz|近代理性主义|1500–1800年", "贝克莱|George Berkeley|经验主义|1500–1800年", "亚当·斯密|Adam Smith|道德与政治经济思想|1500–1800年", "边沁|Jeremy Bentham|功利主义|1800–1945年", "约翰·斯图亚特·密尔|John Stuart Mill|自由主义与功利主义|1800–1945年", "叔本华|Arthur Schopenhauer|意志哲学|1800–1945年", "费尔巴哈|Ludwig Feuerbach|青年黑格尔派|1800–1945年", "巴枯宁|Mikhail Bakunin|无政府主义|1800–1945年", "威廉·詹姆斯|William James|实用主义|1800–1945年", "皮尔士|Charles Sanders Peirce|实用主义与符号学|1800–1945年", "罗素|Bertrand Russell|分析哲学|1800–1945年", "弗雷格|Gottlob Frege|逻辑与语言哲学|1800–1945年", "卡尔纳普|Rudolf Carnap|逻辑经验主义|1800–1945年"
  ],
  "非洲": [
    "普塔霍特普|Ptahhotep|古埃及智慧传统|公元前500年以前", "奥鲁米拉|Orunmila|约鲁巴思想传统|公元前500年以前", "艾哈迈德·巴巴|Ahmad Baba|廷巴克图学术传统|1500–1800年", "扎拉·雅各布|Zera Yacob|埃塞俄比亚哲学|1500–1800年", "安东·威廉·阿莫|Anton Wilhelm Amo|非洲与欧洲启蒙哲学|1500–1800年", "爱德华·布莱登|Edward Wilmot Blyden|泛非思想|1800–1945年", "詹姆斯·霍顿|Africanus Horton|西非政治思想|1800–1945年", "夸梅·恩克鲁玛|Kwame Nkrumah|泛非主义|1945年至今", "朱利叶斯·尼雷尔|Julius Nyerere|非洲社会主义|1945年至今", "利奥波德·桑戈尔|Leopold Sedar Senghor|黑人性与人文主义|1945年至今", "谢赫·安塔·迪奥普|Cheikh Anta Diop|非洲历史思想|1945年至今", "阿米尔卡·卡布拉尔|Amilcar Cabral|反殖民政治思想|1945年至今", "史蒂夫·比科|Steve Biko|黑人意识思想|1945年至今", "约翰·姆比蒂|John Mbiti|非洲宗教哲学|1945年至今", "夸西·维雷杜|Kwasi Wiredu|当代非洲哲学|1945年至今", "保兰·洪通吉|Paulin Hountondji|当代非洲哲学|1945年至今", "亨利·奥德拉·奥鲁卡|Henry Odera Oruka|贤哲哲学|1945年至今", "索菲·奥卢沃莱|Sophie Oluwole|约鲁巴哲学|1945年至今", "阿希尔·姆本贝|Achille Mbembe|后殖民思想|1945年至今", "苏莱曼·巴希尔·迪亚涅|Souleymane Bachir Diagne|非洲与伊斯兰哲学|1945年至今", "伊菲·阿马迪乌梅|Ifi Amadiume|非洲女性主义|1945年至今", "奥耶龙克·奥耶乌米|Oyeronke Oyewumi|非洲性别思想|1945年至今", "莫戈贝·拉莫斯|Mogobe Ramose|乌班图哲学|1945年至今"
  ],
  "美洲与加勒比": [
    "内萨瓦尔科约特尔|Nezahualcoyotl|纳瓦思想传统|500–1500年", "胡安娜修女|Sor Juana Ines de la Cruz|新西班牙思想|1500–1800年", "瓜曼·波马|Felipe Guaman Poma de Ayala|安第斯殖民批判|1500–1800年", "爱默生|Ralph Waldo Emerson|超验主义|1800–1945年", "梭罗|Henry David Thoreau|超验主义与公民不服从|1800–1945年", "弗雷德里克·道格拉斯|Frederick Douglass|废奴与自由思想|1800–1945年", "杜波依斯|W. E. B. Du Bois|黑人政治思想|1800–1945年", "阿兰·洛克|Alain Locke|哈莱姆文艺复兴思想|1800–1945年", "杜威|John Dewey|实用主义|1800–1945年", "罗尔斯|John Rawls|政治自由主义|1945年至今", "蒯因|W. V. O. Quine|分析哲学|1945年至今", "库恩|Thomas Kuhn|科学哲学|1945年至今", "朱迪斯·巴特勒|Judith Butler|性别与政治哲学|1945年至今", "贝尔·胡克斯|bell hooks|黑人女性主义|1945年至今", "安吉拉·戴维斯|Angela Davis|批判理论与废除主义|1945年至今", "科内尔·韦斯特|Cornel West|实用主义与种族思想|1945年至今", "西尔维娅·温特|Sylvia Wynter|加勒比思想与人之批判|1945年至今", "爱德华·格利桑|Edouard Glissant|加勒比关系哲学|1945年至今", "C. L. R. 詹姆斯|C. L. R. James|加勒比马克思主义|1945年至今", "艾梅·塞泽尔|Aime Cesaire|反殖民思想|1945年至今", "何塞·马蒂|Jose Marti|拉丁美洲政治思想|1800–1945年", "何塞·卡洛斯·马里亚特吉|Jose Carlos Mariategui|拉丁美洲马克思主义|1800–1945年", "莱奥波尔多·塞亚|Leopoldo Zea|拉丁美洲哲学|1945年至今", "恩里克·杜塞尔|Enrique Dussel|解放哲学|1945年至今", "阿尼巴尔·基哈诺|Anibal Quijano|殖民性理论|1945年至今", "玛丽亚·卢戈内斯|Maria Lugones|去殖民女性主义|1945年至今", "查尔斯·米尔斯|Charles W. Mills|种族契约论|1945年至今", "刘易斯·戈登|Lewis Gordon|黑人存在主义|1945年至今", "瓦因·德洛里亚|Vine Deloria Jr.|北美原住民思想|1945年至今"
  ],
  "东南亚与大洋洲": [
    "佛使比丘|Buddhadasa Bhikkhu|泰国佛教现代主义|1945年至今", "比里·帕侬荣|Pridi Banomyong|泰国政治思想|1800–1945年", "黎刹|Jose Rizal|菲律宾反殖民思想|1800–1945年", "马比尼|Apolinario Mabini|菲律宾政治思想|1800–1945年", "基·哈查尔·德万托罗|Ki Hajar Dewantara|印度尼西亚教育思想|1800–1945年", "陈马六甲|Tan Malaka|东南亚马克思主义|1800–1945年", "赛义德·侯赛因·阿拉塔斯|Syed Hussein Alatas|殖民知识批判|1945年至今", "赛义德·穆罕默德·纳吉布·阿塔斯|Syed Muhammad Naquib al-Attas|马来伊斯兰思想|1945年至今", "蒂·怀蒂·奥·龙戈迈|Te Whiti o Rongomai|毛利非暴力政治思想|1800–1945年", "埃佩利·豪奥法|Epeli Hauofa|太平洋思想|1945年至今"
  ],
  "跨区域与离散思想传统": [
    "爱德华·萨义德|Edward Said|后殖民思想|1945年至今", "斯皮瓦克|Gayatri Chakravorty Spivak|后殖民思想|1945年至今", "霍米·巴巴|Homi K. Bhabha|后殖民思想|1945年至今", "斯图亚特·霍尔|Stuart Hall|文化研究|1945年至今", "唐娜·哈拉维|Donna Haraway|科学技术与女性主义|1945年至今", "布鲁诺·拉图尔|Bruno Latour|科学技术研究|1945年至今", "朱迪思·施克拉|Judith Shklar|政治思想与流亡经验|1945年至今", "玛莎·努斯鲍姆|Martha Nussbaum|伦理与能力进路|1945年至今", "夸梅·安东尼·阿皮亚|Kwame Anthony Appiah|世界主义与身份哲学|1945年至今", "迪佩什·查克拉巴蒂|Dipesh Chakrabarty|后殖民历史思想|1945年至今"
  ]
};

const candidates = [];
for (const [primaryRegion, entries] of Object.entries(groups)) {
  for (const entry of entries) {
    const [name, englishName, tradition, era] = entry.split("|");
    candidates.push({
      id: `candidate-${String(candidates.length + 1).padStart(3, "0")}`,
      name,
      englishName,
      primaryRegion,
      era,
      tradition,
      selectionReason: `补充${primaryRegion}与${tradition}在世界思想史中的代表性、争论或传播路径。`,
      sourceAvailability: "audit-required",
      expectedTier: "index",
      gapTags: [primaryRegion, era, tradition],
    });
  }
}

if (candidates.length !== 210) throw new Error(`Expected 210 candidates, found ${candidates.length}.`);
const names = candidates.map((candidate) => candidate.englishName);
if (new Set(names).size !== names.length) throw new Error("Coverage candidates contain duplicate English names.");
candidates.forEach((candidate, index) => { candidate.batch = (index % 7) + 1; });

const plan = {
  version: 1,
  status: "editorial-research-queue",
  publishedBaseline: 30,
  candidateCount: candidates.length,
  targetTotal: 240,
  regionTargets: {
    "东亚": 35, "南亚": 35, "西亚、中亚及伊斯兰思想世界": 30, "欧洲与地中海": 65,
    "非洲": 25, "美洲与加勒比": 30, "东南亚与大洋洲": 10, "跨区域与离散思想传统": 10,
  },
  eraTargets: {
    "公元前500年以前": 20, "公元前500年至公元500年": 40, "500–1500年": 40,
    "1500–1800年": 45, "1800–1945年": 55, "1945年至今": 40,
  },
  batchRules: {
    batchCount: 7,
    approximateBatchSize: 30,
    minimumRegionsPerBatch: 4,
    minimumErasPerBatch: 3,
    maximumSingleRegionShare: 0.4,
    publicationRule: "候选→内容编辑→学术复核→发布；名单本身不构成正式条目。",
  },
  candidates,
};

const target = path.resolve(import.meta.dirname, "..", "content", "knowledge", "coverage", "people.json");
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(plan, null, 2)}\n`);
console.log(`Coverage plan generated with ${candidates.length} candidates in 7 batches.`);
