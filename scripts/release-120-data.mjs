export const RELEASE_SOURCE_LIBRARY = {
  chinese: {
    id: "src-encyclopedia-chinese-philosophy",
    title: "Encyclopedia of Chinese Philosophy",
    authors: ["Cua, Antonio S. (ed.)"],
    sourceType: "scholarly-book",
    publication: "Routledge",
    year: 2003,
    isbn: "9780415939133",
    language: "en",
    locatorPrefix: "对应人物与学派条目",
  },
  japanese: {
    id: "src-japanese-philosophy-sourcebook",
    title: "Japanese Philosophy: A Sourcebook",
    authors: ["Heisig, James W.", "Kasulis, Thomas P.", "Maraldo, John C. (eds.)"],
    sourceType: "scholarly-book",
    publication: "University of Hawai‘i Press",
    year: 2011,
    isbn: "9780824835525",
    language: "en",
    locatorPrefix: "对应人物、学派与选文导言",
  },
  indian: {
    id: "src-encyclopedia-indian-philosophies",
    title: "Encyclopedia of Indian Philosophies",
    authors: ["Potter, Karl H. (general ed.)"],
    sourceType: "scholarly-book",
    publication: "Motilal Banarsidass / Princeton University Press",
    year: 1970,
    language: "en",
    locatorPrefix: "相关卷中的人物、学派与文本条目",
  },
  islamic: {
    id: "src-history-islamic-philosophy",
    title: "History of Islamic Philosophy",
    authors: ["Nasr, Seyyed Hossein", "Leaman, Oliver (eds.)"],
    sourceType: "scholarly-book",
    publication: "Routledge",
    year: 1996,
    isbn: "9780415131599",
    language: "en",
    locatorPrefix: "对应人物及思想运动专章",
  },
  jewish: {
    id: "src-history-jewish-philosophy",
    title: "History of Jewish Philosophy",
    authors: ["Frank, Daniel H.", "Leaman, Oliver (eds.)"],
    sourceType: "scholarly-book",
    publication: "Routledge",
    year: 1997,
    isbn: "9780415080644",
    language: "en",
    locatorPrefix: "对应人物与时期专章",
  },
  european: {
    id: "src-routledge-encyclopedia-philosophy",
    title: "Routledge Encyclopedia of Philosophy",
    authors: ["Craig, Edward (general ed.)"],
    sourceType: "scholarly-encyclopedia",
    publication: "Routledge",
    year: 1998,
    isbn: "9780415187091",
    language: "en",
    locatorPrefix: "同名人物条目及条目内参考书目",
  },
  african: {
    id: "src-companion-african-philosophy",
    title: "A Companion to African Philosophy",
    authors: ["Wiredu, Kwasi (ed.)"],
    sourceType: "scholarly-book",
    publication: "Blackwell",
    year: 2004,
    isbn: "9781405128858",
    language: "en",
    locatorPrefix: "对应人物、地区传统与论题专章",
  },
  latin: {
    id: "src-companion-latin-american-philosophy",
    title: "A Companion to Latin American Philosophy",
    authors: ["Nuccetelli, Susana", "Schutte, Ofelia", "Bueno, Otávio (eds.)"],
    sourceType: "scholarly-book",
    publication: "Wiley-Blackwell",
    year: 2010,
    isbn: "9781405179799",
    language: "en",
    locatorPrefix: "对应人物、国家传统与论题专章",
  },
  american: {
    id: "src-companion-american-philosophy",
    title: "A Companion to American Philosophy",
    authors: ["Misak, Cheryl (ed.)"],
    sourceType: "scholarly-book",
    publication: "Wiley-Blackwell",
    year: 2008,
    isbn: "9781405145394",
    language: "en",
    locatorPrefix: "对应人物与思想运动专章",
  },
  indigenous: {
    id: "src-routledge-indigenous-philosophy",
    title: "The Routledge Handbook of Indigenous Philosophy",
    authors: ["Waters, Anne (ed.)"],
    sourceType: "scholarly-book",
    publication: "Routledge",
    year: 2024,
    language: "en",
    locatorPrefix: "相关传统、人物与政治哲学专章",
  },
  southeast_asia: {
    id: "src-routledge-southeast-asian-thinkers",
    title: "Routledge Handbook of Southeast Asian Culture and Society",
    authors: ["King, Victor T. (ed.)"],
    sourceType: "scholarly-book",
    publication: "Routledge",
    year: 2016,
    language: "en",
    locatorPrefix: "相关国家、思想运动与人物专章",
  },
  cultural_studies: {
    id: "src-cultural-studies-reader",
    title: "The Cultural Studies Reader",
    authors: ["During, Simon (ed.)"],
    sourceType: "scholarly-book",
    publication: "Routledge",
    year: 2007,
    language: "en",
    locatorPrefix: "对应作者选文及编者导言",
  },
  sts: {
    id: "src-handbook-science-technology-studies",
    title: "The Handbook of Science and Technology Studies",
    authors: ["Felt, Ulrike", "Fouché, Rayvon", "Miller, Clark A.", "Smith-Doerr, Laurel (eds.)"],
    sourceType: "scholarly-book",
    publication: "MIT Press",
    year: 2017,
    language: "en",
    locatorPrefix: "行动者网络、女性主义科学研究与相关作者专章",
  },
};

// candidateId | slug | start | end | certainty | placeId | placeName | historicalRegion | lat | lon | concept | question | thesis | source | workId | workTitle | originalTitle | workDate | languages
const RAW_RELEASE_PEOPLE = `
candidate-001\tlaozi\t-600\t-400\tdisputed\tluoyang\t洛阳\t周王畿\t34.62\t112.45\t无为\t秩序能否在减少强制和欲望中形成？\t道的运作不依赖强制，人应以无为和朴素回应万物的自生变化\tchinese\tdaodejing\t《道德经》\t道德經\t战国时期逐步形成\tzh
candidate-002\tmozi\t-470\t-391\tapproximate\tluguo\t鲁国\t战国诸国\t35.4\t116.6\t兼爱\t政治与伦理应以何种可检验标准减少天下之害？\t以兼爱、非攻和尚贤衡量制度，使行动增进普遍利益而非宗族偏私\tchinese\tmozi-text\t《墨子》\t墨子\t战国至汉代编成\tzh
candidate-003\tmencius\t-372\t-289\tapproximate\tzoucheng\t邹\t战国邹国\t35.4\t116.97\t性善\t人的道德能力如何在政治与日常实践中生长？\t人具有恻隐等道德端绪，仁政与自我修养应保护并扩充这些能力\tchinese\tmencius-text\t《孟子》\t孟子\t战国时期\tzh
candidate-008\tguo-xiang\t252\t312\testablished\tluoyang\t洛阳\t西晋\t34.62\t112.45\t独化\t万物如何在没有外在造物者的情况下各自生成？\t万物各依其性分而独化，自得并非脱离关系而是恰当地处于变化秩序\tchinese\tzhuangzi-guo-commentary\t《庄子注》\t莊子注\t西晋\tzh
candidate-009\thuiyuan\t334\t416\testablished\tlushan\t庐山\t东晋\t29.57\t115.97\t神不灭\t出家修行者与世俗政治权力应保持怎样的关系？\t僧团以超越世俗礼制的修行目标保持相对自主，并借因果报应说明伦理连续性\tchinese\tmonk-not-bow\t《沙门不敬王者论》\t沙門不敬王者論\t东晋\tzh
candidate-010\tzhiyi\t538\t597\testablished\ttiantai\t天台山\t隋代\t29.25\t121.05\t一念三千\t不同佛教教说如何在修行中形成可实践的整体？\t以止观和教相判释统摄多样教法，说明一念之中具足相互依存的世界\tchinese\tmohe-zhiguan\t《摩诃止观》\t摩訶止觀\t隋代讲述、弟子记录\tzh
candidate-015\twang-yangming\t1472\t1529\testablished\tshaoxing\t绍兴\t明代浙江\t30.0\t120.58\t致良知\t道德知识为何必须在具体行动中得到验证？\t良知是人人可自觉的道德判断能力，知与行只有在实践中才构成统一\tchinese\tchuanxi-lu\t《传习录》\t傳習錄\t明代编成\tzh
candidate-016\tli-zhi\t1527\t1602\testablished\tquanzhou\t泉州\t明代福建\t24.87\t118.68\t童心\t个体真诚如何抵抗以经典权威为名的伪饰？\t童心保存未经虚假名教遮蔽的真实感受，经典判断应回到具体生命经验\tchinese\tbook-to-burn\t《焚书》\t焚書\t1590年\tzh
candidate-017\twang-fuzhi\t1619\t1692\testablished\thengyang\t衡阳\t明清之际湖湘\t26.89\t112.57\t气化\t持续变化的世界如何可能具有秩序和伦理方向？\t理不离气而存在，历史与人伦秩序都在具体气化过程和人的实践中展开\tchinese\tchuanshan-yishu\t《船山遗书》\t船山遺書\t清代后期汇编\tzh
candidate-022\thu-shih\t1891\t1962\testablished\tshanghai\t上海\t现代中国\t31.23\t121.47\t实验主义\t传统与现代的思想主张应如何接受公开检验？\t以大胆假设和小心求证的方法处理思想问题，并用历史研究重估传统\tchinese\toutline-chinese-philosophy\t《中国哲学史大纲》\t中國哲學史大綱\t1919年\tzh
candidate-023\tliang-shuming\t1893\t1988\testablished\tbeijing\t北京\t现代中国\t39.9\t116.4\t文化路向\t不同文明的生活取向如何回应现代性的共同困境？\t文化体现处理欲望、关系和自然的不同路向，中国社会更新应重建伦理共同体\tchinese\teastern-western-cultures\t《东西文化及其哲学》\t東西文化及其哲學\t1921年\tzh
candidate-024\tfeng-youlan\t1895\t1990\testablished\tbeijing\t北京\t现代中国\t39.9\t116.4\t人生境界\t哲学反思如何提升人对自身生活意义的理解？\t通过系统重构中国哲学概念并区分人生境界，使传统思想进入现代论证语言\tchinese\thistory-chinese-philosophy-feng\t《中国哲学史》\t中國哲學史\t1934年\tzh
candidate-029\tkukai\t774\t835\testablished\tkyoto\t平安京\t平安时代日本\t35.01\t135.77\t即身成佛\t语言、身体和仪式如何成为觉悟的现实媒介？\t身语意与宇宙佛的活动相应，使成佛不是遥远结果而可在当下身体中实现\tjapanese\tten-luminous-stages\t《十住心论》\t十住心論\t830年代\tja
candidate-030\togyu-sorai\t1666\t1728\testablished\tedo\t江户\t德川日本\t35.68\t139.76\t古文辞\t政治秩序应依据内在道德直觉还是历史制度？\t回到古代语言和礼乐制度理解先王之道，反对把政治简化为内在心性修养\tjapanese\tbendo\t《辨道》\t弁道\t1717年\tja
candidate-031\tito-jinsai\t1627\t1705\testablished\tkyoto\t京都\t德川日本\t35.01\t135.77\t古义学\t伦理意义如何从日常人伦而非抽象形上原则中产生？\t以古义学重读经典，强调仁义在具体情感、交往和共同生活中实现\tjapanese\tgomojigi\t《语孟字义》\t語孟字義\t17世纪后期\tja
candidate-036\tgargi-vachaknavi\t-800\t-500\tdisputed\tmithila\t弥提罗\t吠陀时代南亚\t26.35\t86.08\t不坏者\t世界的终极根据能否由层层追问加以把握？\t通过公开辩论追问万物所依，最终把讨论引向不可毁坏且超越对象化描述的根据\tindian\tbrihadaranyaka\t《广林奥义书》\tBṛhadāraṇyaka Upaniṣad\t约公元前一千纪中叶\tsa
candidate-037\tmaitreyi\t-800\t-500\tdisputed\tmithila\t弥提罗\t吠陀时代南亚\t26.35\t86.08\t不朽\t财富与亲密关系能否给予人真正的不朽？\t一切被爱之物因自我而可爱，对自我的认识比财富更接近不朽问题的核心\tindian\tbrihadaranyaka-maitreyi\t《广林奥义书·弥勒依对话》\tBṛhadāraṇyaka Upaniṣad\t约公元前一千纪中叶\tsa
candidate-038\tkapila\t-700\t-400\tdisputed\tgangetic-north\t恒河上游地区\t古代南亚\t27.2\t78.0\t原质\t经验世界与纯粹意识为何必须区分？\t数论传统以原质的演化解释经验世界，并以辨别神我与原质通向解脱\tindian\tsamkhya-tradition\t《数论颂》传统\tSāṃkhyakārikā\t后世系统化文本\tsa
candidate-043\tbadarayana\t-200\t200\tdisputed\tvaranasi\t波罗奈\t古代南亚\t25.32\t82.97\t梵经诠释\t奥义书中多样的终极实在论述如何获得系统解释？\t以简约经句组织关于梵、自我、世界和解脱的论争，奠定吠檀多注释传统\tindian\tbrahma-sutra\t《梵经》\tBrahmasūtra\t约公元前后数世纪\tsa
candidate-044\tashvaghosha\t80\t150\tapproximate\tayodhya\t阿逾陀\t贵霜时期南亚\t26.8\t82.2\t信与修行\t诗歌与叙事如何引导人理解觉悟之路？\t借佛陀生平和大乘论述把信、智慧与修行结合，使哲学教义获得文学表达\tindian\tbuddhacarita\t《佛所行赞》\tBuddhacarita\t约2世纪\tsa
candidate-045\tvasubandhu\t316\t396\tapproximate\tgandhara\t犍陀罗\t古代南亚西北部\t34.0\t71.5\t三性\t经验对象与认识结构之间是什么关系？\t以三性和识的分析说明对象经验如何被构成，并以转依描述认识和解脱的改变\tindian\ttrimsika\t《唯识三十颂》\tTriṃśikā-vijñaptimātratā\t约4至5世纪\tsa
candidate-050\tramanuja\t1017\t1137\testablished\tsrirangam\t室利兰伽姆\t中世纪南亚\t10.86\t78.69\t限定不二\t统一的终极实在如何容纳真实的灵魂与世界？\t梵是一体却具有灵魂和世界的真实差异，虔敬与神恩使个体进入解脱关系\tindian\tsri-bhasya\t《室利疏》\tŚrībhāṣya\t12世纪\tsa
candidate-051\tmadhva\t1238\t1317\tapproximate\tudupi\t乌杜皮\t中世纪南亚\t13.34\t74.75\t五差别\t神、灵魂和世界的差异为何不能被还原？\t五类真实差别构成存在秩序，个体通过知识、虔敬与神恩而趋向解脱\tindian\tanuvyakhyana\t《随释》\tAnuvyākhyāna\t13世纪\tsa
candidate-052\tabhinavagupta\t950\t1020\tapproximate\tkashmir\t克什米尔\t中世纪南亚\t34.08\t74.8\t再认识\t意识如何在多样经验中重新认识自身的自由？\t世界是绝对意识的显现，审美经验与密续修行可促成对自身神性自由的再认识\tindian\ttantraloka\t《密续之光》\tTantrāloka\t约10至11世纪\tsa
candidate-057\tgangesha\t1325\t1400\tapproximate\tmithila\t弥提罗\t中世纪南亚\t26.35\t86.08\t认知根据\t一个认知何以被判定为有效知识？\t以精密的新正理语言分析知觉、推理和认知效力，区分对象与关于对象的限定关系\tindian\ttattvacintamani\t《真理如意宝》\tTattvacintāmaṇi\t14世纪\tsa
candidate-058\tkabir\t1440\t1518\tapproximate\tvaranasi\t波罗奈\t北印度\t25.32\t82.97\t无属性神\t宗教身份和仪式能否替代直接的精神觉知？\t以诗歌批判教派排他与空洞仪式，强调超越属性分别的神圣实在和内在觉醒\tindian\tbijak\t《种子集》\tBījak\t口传后编\thi
candidate-059\tguru-nanak\t1469\t1539\testablished\tkartarpur\t卡尔塔普尔\t旁遮普\t32.09\t75.38\t唯一者\t平等的共同生活如何从对唯一神圣实在的体认中建立？\t记念唯一者、诚实劳动和分享所得相互贯通，并否定种姓和宗教身份的绝对化\tindian\tguru-granth-nanak\t《古鲁·格兰特·萨希卜》中的那纳克赞歌\tGuru Granth Sahib\t16世纪作品、1604年初编\tpa
candidate-064\tb-r-ambedkar\t1891\t1956\testablished\tmumbai\t孟买\t现代印度\t19.08\t72.88\t种姓灭除\t形式平等如何转化为反对种姓压迫的社会民主？\t自由、平等与博爱必须进入社会关系，宪法政治若不消除种姓便不能兑现民主\tindian\tannihilation-caste\t《种姓的消灭》\tAnnihilation of Caste\t1936年\ten
candidate-065\tsri-aurobindo\t1872\t1950\testablished\tpondicherry\t本地治里\t现代印度\t11.94\t79.81\t整体瑜伽\t意识与物质的演化能否被理解为同一精神进程？\t现实是意识逐步显现的演化，整体瑜伽旨在转化个体与集体生命而非逃离世界\tindian\tlife-divine\t《神圣人生论》\tThe Life Divine\t1939至1940年定本\ten
candidate-066\tjiddu-krishnamurti\t1895\t1986\testablished\tchennai\t马德拉斯\t现代印度\t13.08\t80.27\t无选择觉察\t心灵能否不依附权威和固定方法而获得自由？\t对思想、恐惧和关系进行无选择觉察，可显露条件化过程并打开心理自由\tindian\tfirst-last-freedom\t《最初与最终的自由》\tThe First and Last Freedom\t1954年\ten
candidate-071\tabu-bakr-al-razi\t865\t925\tapproximate\tray\t赖伊\t阿拔斯时期伊朗\t35.59\t51.44\t理性自足\t理性探究能否独立承担认识自然与改善生活的任务？\t重视观察、医学经验和哲学理性，并以伦理节制治疗灵魂的激情和迷误\tislamic\tspiritual-physick\t《精神医学》\tal-Ṭibb al-rūḥānī\t约10世纪\tar
candidate-072\tal-ghazali\t1058\t1111\testablished\ttus\t图斯\t塞尔柱时期呼罗珊\t36.47\t59.6\t因果习惯\t哲学证明、宗教启示和灵性体验各有何种认知边界？\t批判哲学家的若干必然性主张，同时把逻辑、神学与苏菲实践置于不同认识层次\tislamic\tincoherence-philosophers\t《哲学家的矛盾》\tTahāfut al-falāsifa\t11世纪末\tar
candidate-073\tibn-rushd\t1126\t1198\testablished\tcordoba\t科尔多瓦\t安达卢斯\t37.89\t-4.78\t哲学与律法\t哲学论证与宗教律法能否面向不同读者而保持一致？\t可靠证明不会与启示真义冲突，经文解释应依据论证能力和文本语境分层进行\tislamic\tdecisive-treatise\t《决断论》\tFaṣl al-maqāl\t12世纪\tar
candidate-078\tal-biruni\t973\t1048\testablished\tkath\t卡特\t花剌子模\t41.7\t60.75\t比较方法\t如何在不把他者传统化约为己方分类的前提下理解它？\t结合语言学习、观察和文本比较描述印度宗教与科学，区分报告、证据与评价\tislamic\tbiruni-india\t《印度志》\tTaḥqīq mā li-l-Hind\t约1030年\tar
candidate-079\tibn-khaldun\t1332\t1406\testablished\ttunis\t突尼斯\t马格里布\t36.81\t10.18\t群体团结\t王朝、城市和知识制度为何呈现可解释的兴衰模式？\t群体团结支撑政治权力，其强弱受生计方式、奢侈化和制度环境的历史变化影响\tislamic\tmuqaddimah\t《历史绪论》\tal-Muqaddima\t1377年\tar
candidate-080\trabia-al-adawiyya\t717\t801\tapproximate\tbasra\t巴士拉\t阿拔斯时期伊拉克\t30.51\t47.78\t无条件之爱\t对神圣者的爱能否超越奖赏与惩罚的计算？\t以无条件的神爱净化敬拜动机，使精神实践不再由天堂希望或地狱恐惧支配\tislamic\trabia-sayings\t《拉比娅言行录》传统\tAkhbār Rābiʿa\t后世传记汇编\tar
candidate-085\tgersonides\t1288\t1344\testablished\tprovence\t普罗旺斯\t中世纪犹太社群\t43.95\t4.81\t能动理智\t人的知识和自由如何与神知及宇宙秩序相容？\t以亚里士多德主义重构能动理智、预言与天意，并坚持哲学论证可澄清经文问题\tjewish\twars-lord\t《上主之战》\tMilḥamot Ha-Shem\t1329年\the
candidate-086\tmoses-mendelssohn\t1729\t1786\testablished\tberlin\t柏林\t普鲁士\t52.52\t13.4\t宗教宽容\t国家权力能否强制信念与宗教判断？\t信念不能由强制产生，国家应保障公民权利而宗教共同体依靠教导与自愿实践\tjewish\tjerusalem-mendelssohn\t《耶路撒冷》\tJerusalem oder über religiöse Macht und Judentum\t1783年\tde
candidate-087\tbahaullah\t1817\t1892\testablished\tacre\t阿卡\t奥斯曼帝国\t32.93\t35.08\t人类一体\t多样宗教与民族如何被理解为共同历史中的统一人类？\t启示在历史中渐进展开，人类一体要求超越宗派和民族偏见并建立世界性伦理\tislamic\tkitab-i-iqan\t《笃信经》\tKitáb-i-Íqán\t1861至1862年\tfa
candidate-092\tleila-ahmed\t1940\t2023\testablished\tcambridge-mass\t剑桥\t当代美国\t42.37\t-71.11\t性别话语\t殖民权力与本土父权如何共同塑造关于穆斯林女性的叙述？\t性别观念须在制度与殖民史中分析，不能把面纱或伊斯兰传统处理成单一不变的符号\tislamic\twomen-gender-islam\t《伊斯兰中的女性与性别》\tWomen and Gender in Islam\t1992年\ten
candidate-093\tfazlur-rahman\t1919\t1988\testablished\tchicago\t芝加哥\t现代伊斯兰思想\t41.88\t-87.63\t双重运动\t经典启示如何在现代社会产生负责任的新判断？\t解释应从具体经文回到其历史道德原则，再由原则返回当代情境形成规范判断\tislamic\tislam-modernity\t《伊斯兰与现代性》\tIslam and Modernity\t1982年\ten
candidate-094\tamina-wadud\t1952\t2026\testablished\tjakarta\t雅加达\t当代跨区域伊斯兰社群\t-6.2\t106.85\t性别公正诠释\t经典诠释如何识别并纠正父权阅读带来的性别不平等？\t从文本整体、语法和历史语境重读古兰经，以神圣统一原则批判性别等级化\tislamic\tquran-woman\t《古兰经与女性》\tQur'an and Woman\t1992年\ten
candidate-099\tpythagoras\t-570\t-495\tapproximate\tcroton\t克罗顿\t大希腊\t39.08\t17.13\t数的秩序\t宇宙秩序、音乐比例和灵魂生活如何彼此关联？\t毕达哥拉斯传统以数与和谐解释宇宙，并把共同生活和灵魂净化纳入哲学实践\teuropean\tpythagorean-testimonia\t《毕达哥拉斯证言与残篇》\tPythagorean testimonia\t古代证言汇编\tgrc
candidate-100\theraclitus\t-540\t-480\tapproximate\tephesus\t以弗所\t爱奥尼亚\t37.94\t27.34\t逻各斯\t变化中的对立如何仍能构成共同秩序？\t逻各斯使对立冲突呈现可理解的结构，万物在持续变化中保持张力式统一\teuropean\theraclitus-fragments\t《赫拉克利特残篇》\tFragments\t约公元前500年\tgrc
candidate-101\tparmenides\t-515\t-450\tapproximate\telea\t埃利亚\t大希腊\t40.16\t15.16\t存在之路\t思维与言说能否把握非存在？\t严格探究必须沿存在之路前进，因为非存在既不可被思也不可被有意义地说出\teuropean\tparmenides-poem\t《论自然》残篇\tOn Nature\t约公元前5世纪\tgrc
candidate-106\tepicurus\t-341\t-270\testablished\tathens\t雅典\t希腊化世界\t37.98\t23.73\t宁静\t有限生命如何摆脱对神与死亡的恐惧？\t通过自然哲学、欲望辨析和友爱实践消除无根据的恐惧，以身体无痛和心灵宁静为幸福\teuropean\tletter-menoeceus\t《致美诺伊克斯书》\tLetter to Menoeceus\t约公元前3世纪\tgrc
candidate-107\tzeno-citium\t-334\t-262\tapproximate\tathens\t雅典\t希腊化世界\t37.98\t23.73\t顺应自然\t自由如何可能于一个因果有序的宇宙之中？\t德性在于理性地顺应自然，通过判断训练使行动与共同宇宙的秩序协调\teuropean\tstoic-testimonia-zeno\t《早期斯多亚派残篇》中的芝诺材料\tStoicorum Veterum Fragmenta\t古代材料、近代汇编\tgrc
candidate-108\tchrysippus\t-279\t-206\tapproximate\tathens\t雅典\t希腊化世界\t37.98\t23.73\t命题逻辑\t必然因果与人的责任如何能够同时成立？\t以逻辑和相容论说明事件因果相连却仍可按行动者自身判断归责\teuropean\tstoic-testimonia-chrysippus\t《早期斯多亚派残篇》中的克律西波材料\tStoicorum Veterum Fragmenta\t古代材料、近代汇编\tgrc
candidate-113\tplotinus\t204\t270\tapproximate\trome\t罗马\t罗马帝国\t41.9\t12.5\t流溢\t多样存在如何从绝对统一者产生而不损害其统一？\t万有由太一经理智和灵魂层层流溢，哲学与内在净化使灵魂回归其统一根源\teuropean\tenneads\t《九章集》\tEnneads\t3世纪、波菲利编订\tgrc
candidate-114\thypatia\t355\t415\tapproximate\talexandria\t亚历山大里亚\t晚期古代埃及\t31.2\t29.92\t数学哲学教育\t数学、天文学与哲学教育如何共同训练理性？\t通过新柏拉图主义教学和数学注释维系公共求知共同体，其本人作品多仅见后世证言\teuropean\thypatia-testimonia\t《希帕提娅古代证言》\tAncient testimonia on Hypatia\t4至5世纪材料\tgrc
candidate-115\tboethius\t477\t524\tapproximate\travenna\t拉文纳\t东哥特王国\t44.42\t12.2\t永恒与预知\t神的预知是否会取消人的自由选择？\t永恒并非无限时间而是对生命整体的同时把握，因此预知不必成为事件的强制原因\teuropean\tconsolation-philosophy\t《哲学的慰藉》\tDe consolatione philosophiae\t约524年\tla
candidate-120\twilliam-ockham\t1287\t1347\tapproximate\toxford\t牛津\t中世纪英格兰\t51.75\t-1.25\t唯名论\t普遍概念是否需要对应独立存在的普遍实体？\t个体首先存在，普遍项是心灵和语言中的符号；解释不应无必要地增设实体\teuropean\tsumma-logicae\t《逻辑大全》\tSumma Logicae\t约1323年\tla
candidate-121\tmeister-eckhart\t1260\t1328\tapproximate\tcologne\t科隆\t中世纪德意志\t50.94\t6.96\t离执\t心灵如何通过放下占有而向神圣根基敞开？\t离执不是消极空无，而是放下自我意志，使灵魂深处与神性根基的生成相遇\teuropean\tgerman-sermons-eckhart\t《德语讲道集》\tDeutsche Predigten\t13至14世纪\tmhg
candidate-122\tchristine-de-pizan\t1364\t1430\tapproximate\tparis\t巴黎\t中世纪法国\t48.86\t2.35\t女性之城\t贬抑女性的知识传统如何由历史反例和理性论证加以反驳？\t以寓言之城汇聚女性的德性、能力和贡献，揭示厌女论述的偏见与教育成因\teuropean\tbook-city-ladies\t《淑女之城》\tLe Livre de la Cité des Dames\t1405年\tfrm
candidate-127\tgeorge-berkeley\t1685\t1753\testablished\tdublin\t都柏林\t近代爱尔兰\t53.35\t-6.26\t被感知即存在\t物质实体是否超出我们能够经验和说明的范围？\t感觉对象的存在就在于被感知，持续秩序由精神及神的知觉说明而非不可知物质支撑\teuropean\tprinciples-human-knowledge\t《人类知识原理》\tA Treatise Concerning the Principles of Human Knowledge\t1710年\ten
candidate-128\tadam-smith\t1723\t1790\testablished\tedinburgh\t爱丁堡\t苏格兰启蒙运动\t55.95\t-3.19\t公正旁观者\t个体如何形成能够超越自身偏私的道德判断？\t同感与想象中的公正旁观者校正自爱，使道德规范在社会互动与制度中形成\teuropean\ttheory-moral-sentiments\t《道德情操论》\tThe Theory of Moral Sentiments\t1759年\ten
candidate-129\tjeremy-bentham\t1748\t1832\testablished\tlondon\t伦敦\t近代英国\t51.51\t-0.13\t最大幸福\t法律与制度应以何种公共标准评价？\t以受影响者的快乐与痛苦衡量行动和制度，反对缺乏经验依据的自然权利修辞\teuropean\tprinciples-morals-legislation\t《道德与立法原理导论》\tAn Introduction to the Principles of Morals and Legislation\t1789年\ten
candidate-134\twilliam-james\t1842\t1910\testablished\tcambridge-mass\t剑桥\t美国马萨诸塞\t42.37\t-71.11\t实用主义真理观\t观念的真理如何在经验和行动中显现？\t观念的意义与真理要在经验后果中检验，同时保留多元世界和真实选择的开放性\tamerican\tpragmatism-james\t《实用主义》\tPragmatism\t1907年\ten
candidate-135\tcharles-sanders-peirce\t1839\t1914\testablished\tcambridge-mass\t剑桥\t美国马萨诸塞\t42.37\t-71.11\t实用主义准则\t概念的意义如何通过可设想的实践效果澄清？\t以实用主义准则和共同探究说明意义与信念，并用符号过程解释思维与世界的联系\tamerican\tpeirce-papers\t《皮尔士论文集》\tCollected Papers of Charles Sanders Peirce\t20世纪编订\ten
candidate-136\tbertrand-russell\t1872\t1970\testablished\tcambridge-uk\t剑桥\t现代英国\t52.21\t0.12\t逻辑分析\t语言的逻辑形式如何帮助化解哲学困惑？\t以逻辑分析区分语法表面与命题结构，并据此研究指称、知识和数学基础\teuropean\ton-denoting\t《论指称》\tOn Denoting\t1905年\ten
candidate-141\tahmad-baba\t1556\t1627\testablished\ttimbuktu\t廷巴克图\t桑海与摩洛哥统治时期\t16.77\t-3.01\t合法权威\t学术与法律判断如何面对政治强制和奴役实践？\t以马立克法学论证学者责任、正当统治与自由身份，反对把肤色直接作为奴役依据\tafrican\tahmad-baba-mi-raj\t《攀升阶梯》\tMiʿrāj al-ṣuʿūd\t1615年\tar
candidate-142\tzera-yacob\t1599\t1692\tapproximate\taxum\t阿克苏姆\t埃塞俄比亚\t14.13\t38.72\t理性审查\t宗教传统的命令应如何接受理性和善的检验？\t以人人共有的理性审查启示解释，凡违背受造者平等与善的教说都应被质疑\tafrican\thatata-zera-yacob\t《探究》\tHatäta\t1667年\tgez
candidate-143\tanton-wilhelm-amo\t1703\t1759\tapproximate\thalle\t哈雷\t启蒙时期德意志\t51.48\t11.97\t心灵非感受性\t感觉应归属于心灵还是有机身体？\t区分心灵的思维活动与身体的感受能力，并以严密论证参与欧洲启蒙哲学争论\tafrican\tamo-apatheia\t《论人类心灵无感受性》\tDe humanae mentis apatheia\t1734年\tla
candidate-148\tleopold-sedar-senghor\t1906\t2001\testablished\tdakar\t达喀尔\t塞内加尔\t14.72\t-17.47\t黑人性\t被殖民者如何肯定自身文化而不封闭于本质主义？\t以黑人性重估非洲审美和关系性知识，并设想差异文化通过对话形成普遍文明\tafrican\tliberte-senghor\t《自由》文集\tLiberté\t1964至1993年\tfr
candidate-149\tcheikh-anta-diop\t1923\t1986\testablished\tdakar\t达喀尔\t现代塞内加尔\t14.72\t-17.47\t历史连续性\t非洲历史如何摆脱殖民知识体系的断裂叙述？\t综合语言学、历史学和科学证据论证非洲文明连续性，并推动自主的历史研究框架\tafrican\tafrican-origin-civilization\t《文明的非洲起源》\tThe African Origin of Civilization\t1974年英译本\tfr
candidate-150\tamilcar-cabral\t1924\t1973\testablished\tconakry\t科纳克里\t几内亚与佛得角解放运动\t9.64\t-13.58\t文化抵抗\t反殖民解放如何同时改变经济结构和文化主体性？\t民族解放必须分析具体生产结构，并通过文化抵抗使人民重新成为自身历史的主体\tafrican\treturn-source-cabral\t《回到源头》\tReturn to the Source\t1973年文集\tpt
candidate-155\thenry-odera-oruka\t1944\t1995\testablished\tnairobi\t内罗毕\t现代肯尼亚\t-1.29\t36.82\t贤哲哲学\t口述传统中的个人批判反思如何被识别为哲学？\t通过访谈区分民间智慧与贤哲的论证性反思，挑战哲学只存在于书面经典的偏见\tafrican\tsage-philosophy\t《贤哲哲学》\tSage Philosophy\t1990年\ten
candidate-156\tsophie-oluwole\t1935\t2018\testablished\tlagos\t拉各斯\t现代尼日利亚\t6.52\t3.38\t互补二元\t约鲁巴思想中的二元关系是否必然意味着相互排斥？\t通过口述文本和概念分析呈现互补而非排他的二元结构，反驳非洲没有哲学的论断\tafrican\tsocrates-orunmila\t《苏格拉底与奥伦米拉》\tSocrates and Ọ̀rúnmìlà\t2014年\ten
candidate-157\tachille-mbembe\t1957\t2026\testablished\tjohannesburg\t约翰内斯堡\t当代非洲\t-26.2\t28.05\t死政治\t主权如何通过决定谁可生存、谁被置于死亡风险中运作？\t死政治揭示殖民、种族化和战争空间中权力对生命暴露程度的差异化分配\tafrican\tnecropolitics\t《死政治》\tNecropolitics\t2019年\tfr
candidate-162\tnezahualcoyotl\t1402\t1472\testablished\ttexcoco\t特斯科科\t阿兹特克三方联盟\t19.51\t-98.88\t花与歌\t短暂生命中何种言说能够接近真实并留下共同记忆？\t诗性传统以花与歌探索无常、友谊和真实，但现存文本的具体作者归属仍需谨慎\tlatin\tcantares-mexicanos\t《墨西哥歌集》中的相关诗歌\tCantares Mexicanos\t16世纪记录\tnah
candidate-163\tsor-juana-ines-de-la-cruz\t1648\t1695\testablished\tmexico-city\t墨西哥城\t新西班牙\t19.43\t-99.13\t女性求知权\t女性为何有权接受教育并参与知识共同体？\t以自传式论辩和经典例证捍卫女性求知，将服从话语转化为对教育制度的批判\tlatin\treply-sor-filotea\t《答菲洛特娅修女书》\tRespuesta a Sor Filotea de la Cruz\t1691年\tes
candidate-164\tfelipe-guaman-poma\t1535\t1616\tapproximate\tcusco\t库斯科\t殖民时期安第斯\t-13.53\t-71.97\t安第斯善治\t殖民统治如何从被征服者的历史与伦理视角接受审判？\t结合图像、编年史与劝谏揭露殖民暴力，并以安第斯共同体经验提出善治秩序\tlatin\tnew-chronicle-good-government\t《新编年史与善治》\tNueva corónica y buen gobierno\t约1615年\tes
candidate-169\talain-locke\t1885\t1954\testablished\tharlem\t哈莱姆\t现代美国\t40.81\t-73.95\t文化多元\t群体文化如何在民主社会中获得承认而不被固定化？\t以新黑人和文化多元主义重估黑人艺术创造，使差异成为民主共同体的资源\tamerican\tnew-negro\t《新黑人》\tThe New Negro\t1925年\ten
candidate-170\tjohn-dewey\t1859\t1952\testablished\tchicago\t芝加哥\t现代美国\t41.88\t-87.63\t民主经验\t民主为何不仅是制度，也是一种共同生活方式？\t知识在问题解决中生成，教育和公共沟通应扩展共同探究与参与式民主的条件\tamerican\tpublic-problems\t《公众及其问题》\tThe Public and Its Problems\t1927年\ten
candidate-171\tjohn-rawls\t1921\t2002\testablished\tharvard\t哈佛大学\t当代美国\t42.38\t-71.12\t原初状态\t公平的社会基本制度应依据何种不偏私的原则选择？\t思想实验中的原初状态遮蔽偶然优势，使平等自由和差别原则获得公平选择\tamerican\ttheory-justice\t《正义论》\tA Theory of Justice\t1971年\ten
candidate-176\tangela-davis\t1944\t2026\testablished\toakland\t奥克兰\t当代美国\t37.8\t-122.27\t废除主义\t如何超越监禁制度而处理暴力、责任与社会安全？\t废除主义把监狱置于种族、性别和资本结构中分析，并建设教育、照护与修复性替代方案\tamerican\tare-prisons-obsolete\t《监狱过时了吗？》\tAre Prisons Obsolete?\t2003年\ten
candidate-177\tcornel-west\t1953\t2026\testablished\tprinceton\t普林斯顿\t当代美国\t40.35\t-74.66\t先知实用主义\t民主批判如何结合历史苦难、宗教希望和公共行动？\t先知实用主义以受压迫者经验检验民主承诺，并把批判、同情与集体行动结合\tamerican\trace-matters\t《种族问题》\tRace Matters\t1993年\ten
candidate-178\tsylvia-wynter\t1928\t2026\testablished\tkingston\t金斯敦\t加勒比与离散传统\t17.97\t-76.79\t人之过度代表\t西方现代性如何把特定的人类模型冒充为全体人类？\t批判殖民知识对人的过度代表，并要求从生物与叙事共同构成的角度重想人类\tlatin\tunsettling-coloniality\t《动摇存在、权力、真理与自由的殖民性》\tUnsettling the Coloniality of Being/Power/Truth/Freedom\t2003年\ten
candidate-183\tjose-carlos-mariategui\t1894\t1930\testablished\tlima\t利马\t现代秘鲁\t-12.05\t-77.04\t本土社会主义\t社会主义理论如何回应安第斯土地与原住民现实？\t拒绝机械照搬欧洲模式，从共同土地、殖民结构和原住民问题重构秘鲁社会主义\tlatin\tseven-essays-peru\t《关于秘鲁国情的七篇论文》\tSiete ensayos de interpretación de la realidad peruana\t1928年\tes
candidate-184\tleopoldo-zea\t1912\t2004\testablished\tmexico-city\t墨西哥城\t现代墨西哥\t19.43\t-99.13\t思想的处境性\t拉丁美洲哲学如何在具体历史处境中形成普遍意义？\t思想总从处境出发，殖民边缘对自身历史的反思能够改变关于普遍哲学的定义\tlatin\tamerican-philosophy-zea\t《作为纯粹哲学的美洲哲学》\tLa filosofía americana como filosofía sin más\t1969年\tes
candidate-185\tenrique-dussel\t1934\t2023\testablished\tmexico-city\t墨西哥城\t拉丁美洲解放哲学\t19.43\t-99.13\t外在性\t哲学如何从被现代体系排除者的立场开始？\t他者的外在性向总体化秩序提出伦理要求，解放实践须从殖民受害者的生命出发\tlatin\tphilosophy-liberation\t《解放哲学》\tFilosofía de la liberación\t1977年\tes
candidate-190\tvine-deloria-jr\t1933\t2005\testablished\tstanding-rock\t立岩地区\t北美原住民社群\t46.1\t-100.6\t关系性土地\t知识、宗教与政治责任如何扎根于具体土地关系？\t原住民思想以地方、亲属和条约关系纠正抽象普遍主义，并批判殖民知识制度\tindigenous\tgod-is-red\t《上帝是红色的》\tGod Is Red\t1973年\ten
candidate-191\tbuddhadasa-bhikkhu\t1906\t1993\testablished\tchaiya\t猜耶\t现代泰国\t9.39\t99.2\t空心\t佛教解脱如何转化为面向现代社会的日常实践？\t以缘起和空重释无我，主张在工作与公共生活中减弱执著而非把修行局限于仪式\tsoutheast_asia\thandbook-mankind\t《人类手册》\tHandbook for Mankind\t1956年\tth
candidate-192\tpridi-banomyong\t1900\t1983\testablished\tbangkok\t曼谷\t现代泰国\t13.76\t100.5\t宪政民生\t宪政改革如何与经济正义和国家独立相结合？\t以民权、法治和社会保障推动立宪秩序，并在帝国压力下维护政治自主\tsoutheast_asia\tpridi-economic-plan\t《国家经济计划纲要》\tเค้าโครงการเศรษฐกิจ\t1933年\tth
candidate-197\tsyed-hussein-alatas\t1928\t2007\testablished\tsingapore\t新加坡\t现代东南亚\t1.35\t103.82\t懒惰土著神话\t殖民知识如何把支配秩序伪装成关于被殖民者的事实？\t揭示懒惰土著形象服务于殖民资本和官僚制度，并要求自主社会科学检验概念来源\tsoutheast_asia\tmyth-lazy-native\t《懒惰土著的神话》\tThe Myth of the Lazy Native\t1977年\ten
candidate-198\tsyed-muhammad-naquib-al-attas\t1931\t2026\testablished\tkuala-lumpur\t吉隆坡\t当代马来西亚\t3.14\t101.69\t知识伊斯兰化\t教育与知识分类如何体现关于人和世界的伦理秩序？\t以知识伊斯兰化批判世俗概念移植，并以礼序和恰当位置重建教育目的\tsoutheast_asia\tislam-secularism\t《伊斯兰与世俗主义》\tIslam and Secularism\t1978年\ten
candidate-199\tte-whiti-o-rongomai\t1830\t1907\tapproximate\tparihaka\t帕里哈卡\t毛利社群\t-39.29\t173.84\t非暴力守土\t面对殖民夺地，政治共同体如何以非暴力维护土地关系？\t以集体耕作、拒绝迁移和克制行动抵抗殖民侵占，使土地守护成为共同体伦理\tindigenous\tparihaka-records\t《帕里哈卡历史记录与演说》\tParihaka records and speeches\t19世纪记录\tmi
candidate-204\tstuart-hall\t1932\t2014\testablished\tbirmingham\t伯明翰\t英国与加勒比离散传统\t52.49\t-1.9\t接合\t文化身份与政治联盟如何在历史条件中被暂时连接？\t接合理论把身份、媒体意义和权力视为可变连接，拒绝将种族与文化本质化\tcultural_studies\trepresentation-hall\t《表征》\tRepresentation: Cultural Representations and Signifying Practices\t1997年\ten
candidate-205\tdonna-haraway\t1944\t2026\testablished\tsanta-cruz\t圣克鲁斯\t当代美国\t36.97\t-122.03\t情境知识\t科学客观性如何承认观察者位置而不滑向任意相对主义？\t情境知识要求可追责的局部视角，并以赛博格和伴侣物种重构人类与技术生命关系\tsts\tsimians-cyborgs-women\t《类人猿、赛博格和女人》\tSimians, Cyborgs, and Women\t1991年\ten
candidate-206\tbruno-latour\t1947\t2022\testablished\tparis\t巴黎\t当代法国\t48.86\t2.35\t行动者网络\t科学事实如何在人员、仪器、文本与制度的网络中稳定？\t行动能力分布于人类与非人行动者之间，现代社会的自然与社会分割需要被重新描述\tsts\twe-have-never-modern\t《我们从未现代过》\tNous n'avons jamais été modernes\t1991年\tfr
`;

export const RELEASE_PEOPLE = RAW_RELEASE_PEOPLE.trim().split("\n").map((line) => {
  const [candidateId, slug, startYear, endYear, certainty, placeId, placeName, historicalRegion, lat, lon, concept, question, thesis, sourceKey, workId, workTitle, originalTitle, workDate, languages] = line.split("\t");
  return {
    candidateId,
    slug,
    startYear: Number(startYear),
    endYear: Number(endYear),
    certainty,
    place: { id: placeId, name: placeName, historicalRegion, lat: Number(lat), lon: Number(lon) },
    concept,
    question,
    thesis,
    sourceKey,
    work: { id: workId, title: workTitle, originalTitle, dateLabel: workDate, languages: languages.split(",") },
  };
});
