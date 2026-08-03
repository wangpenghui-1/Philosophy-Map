// Batches 4–6 complete the 210-person public release.
// candidateId | slug | start | end | certainty | placeId | placeName | historicalRegion | lat | lon | concept | question | thesis | source | workId | workTitle | originalTitle | workDate | languages
const RAW_RELEASE_210_ADDITIONS = `
candidate-004\txunzi\t-310\t-235\tapproximate\tlanling\t兰陵\t战国时期\t34.85\t117.86\t性恶\t人的道德秩序如何通过学习和制度形成？\t人的自然倾向需要由礼义、师法和有意识的实践加以转化\tchinese\txunzi-text\t《荀子》\t荀子\t战国晚期至汉初编成\tzh
candidate-005\than-fei\t-280\t-233\tapproximate\thandan\t韩国都城新郑\t战国韩国\t34.4\t113.74\t法术势\t政治秩序如何在不依赖统治者德性的条件下维持？\t公开的法、行政之术与职位之势共同约束官僚和政治行为\tchinese\than-feizi\t《韩非子》\t韓非子\t战国晚期\tzh
candidate-006\tdong-zhongshu\t-179\t-104\tapproximate\tchangan\t长安\t西汉\t34.26\t108.94\t天人感应\t政治伦理如何与宇宙秩序建立规范联系？\t君主政治应以仁义回应天道，灾异论述可成为约束权力的批评语言\tchinese\tchunqiu-fanlu\t《春秋繁露》\t春秋繁露\t汉代编成、归属复杂\tzh
candidate-011\tfazang\t643\t712\testablished\tchangan\t长安\t唐代\t34.26\t108.94\t法界缘起\t每一事物如何同时保持差异又与整体互相涵摄？\t法界缘起以事事无碍说明现象彼此依存并相互映现的结构\tchinese\tessay-golden-lion\t《金狮子章》\t金師子章\t唐代\tzh
candidate-012\than-yu\t768\t824\testablished\tchangan\t长安\t唐代\t34.26\t108.94\t道统\t儒家伦理如何面对佛道思想和帝国制度的挑战？\t以仁义和道统重建儒学的公共正当性，并强调师道与古文的教化作用\tchinese\tyuan-dao\t《原道》\t原道\t唐代\tzh
candidate-013\tzhu-xi\t1130\t1200\testablished\twuyishan\t武夷山\t南宋\t27.72\t118.03\t格物致知\t道德知识如何通过理解事物之理逐步形成？\t格物、读书和涵养相互配合，使心对理的认识落实为日常伦理实践\tchinese\treflections-things-hand\t《近思录》\t近思錄\t1175年编成\tzh
candidate-018\tdai-zhen\t1724\t1777\testablished\tbeijing\t北京\t清代\t39.9\t116.4\t理欲之辨\t抽象道德原则为何可能压制人的真实情感与需要？\t理存在于具体情欲和关系的恰当分寸中，不应成为权威压人的空洞名目\tchinese\tmengzi-zishu-zheng\t《孟子字义疏证》\t孟子字義疏證\t1777年\tzh
candidate-019\tkang-youwei\t1858\t1927\testablished\tguangzhou\t广州\t晚清中国\t23.13\t113.26\t大同\t经典解释如何为制度改革和世界共同体提供方向？\t以今文经学重释孔子为改革者，并以大同设想超越等级和国界的秩序\tchinese\tdatong-shu\t《大同书》\t大同書\t19世纪末至20世纪初\tzh
candidate-020\tliang-qichao\t1873\t1929\testablished\tshanghai\t上海\t近代中国\t31.23\t121.47\t新民\t现代国家的公民主体如何由教育和公共讨论塑造？\t政治更新需要培养具有权利、责任和公共意识的新民，并重估中国思想史\tchinese\txinmin-shuo\t《新民说》\t新民說\t1902至1906年\tzh
candidate-025\tmou-zongsan\t1909\t1995\testablished\ttaipei\t台北\t现代新儒家\t25.04\t121.56\t智的直觉\t儒家道德主体如何回应现代哲学关于知识与自由的问题？\t以道德自觉和智的直觉重构儒家形上学，并区分科学民主与价值根源\tchinese\tphenomenon-thing-itself\t《现象与物自身》\t現象與物自身\t1975年\tzh
candidate-026\tnishida-kitaro\t1870\t1945\testablished\tkyoto\t京都\t近代日本\t35.01\t135.77\t纯粹经验\t主客区分之前的经验如何成为哲学出发点？\t纯粹经验在反思分化之前统一认识与实在，并发展为空间性的场所逻辑\tjapanese\tinquiry-good\t《善的研究》\t善の研究\t1911年\tja
candidate-027\twatsuji-tetsuro\t1889\t1960\testablished\tkyoto\t京都\t近代日本\t35.01\t135.77\t间柄\t个人与共同体如何共同构成伦理主体？\t人存在于关系性的间柄之中，伦理运动在个体否定与共同体回归之间展开\tjapanese\tethics-watsuji\t《伦理学》\t倫理学\t1937至1949年\tja
candidate-032\tyi-hwang\t1501\t1570\testablished\tandong\t安东\t朝鲜王朝\t36.57\t128.73\t四端七情\t道德情感的规范性如何与一般情绪活动区分？\t通过四端七情之辩分析理气发动和道德修养，强调敬的持续实践\tchinese\tten-diagrams-sage-learning\t《圣学十图》\t聖學十圖\t1568年\tko
candidate-033\tjeong-yak-yong\t1762\t1836\testablished\tgangjin\t康津\t朝鲜王朝\t34.64\t126.77\t实学经世\t经典伦理如何转化为改善民生和行政的具体制度？\t以经世实学重释儒家德性，强调官员责任、土地制度和可实行的治理改革\tchinese\tmongmin-simseo\t《牧民心书》\t牧民心書\t1818年\tko
candidate-034\tmahavira\t-599\t-527\tapproximate\tvaishali\t毗舍离\t古代南亚\t25.99\t85.13\t不害\t生命如何通过严格伦理实践摆脱业的束缚？\t不害、非占有与多面真理观共同约束行动和判断，使灵魂趋向解脱\tindian\tagamas-jain\t《耆那教阿含》传统\tĀgama\t口传后编\tprk
candidate-039\tpatanjali\t-200\t400\tdisputed\tgangetic-north\t恒河流域\t古代南亚\t26.0\t82.0\t心识止息\t意识活动如何通过训练而不再支配自我认同？\t瑜伽八支以伦理、身体和禅定实践止息心识波动，使观者安住自身\tindian\tyoga-sutra\t《瑜伽经》\tYogasūtra\t约公元前后数世纪\tsa
candidate-040\tkanada\t-600\t-200\tdisputed\tvaranasi\t波罗奈\t古代南亚\t25.32\t82.97\t范畴与原子\t经验世界能否由基本实体和属性范畴系统解释？\t胜论以实体、性质、运动等范畴及原子组合说明世界的多样与变化\tindian\tvaisesika-sutra\t《胜论经》\tVaiśeṣikasūtra\t约公元前一千纪后半\tsa
candidate-041\takshapada-gautama\t-200\t200\tdisputed\tmithila\t弥提罗\t古代南亚\t26.35\t86.08\t正理推论\t可靠知识的来源和有效推论应如何辨别？\t正理派以知觉、推论、类比和证言分析知识，并用论辩规则排除谬误\tindian\tnyaya-sutra\t《正理经》\tNyāyasūtra\t约公元前后数世纪\tsa
candidate-046\tasanga\t310\t390\tapproximate\tgandhara\t犍陀罗\t古代南亚西北部\t34.0\t71.5\t阿赖耶识\t经验连续性与业力如何在无常心识中得到说明？\t阿赖耶识保存潜能并支持经验相续，修行通过转依改变认识结构\tindian\tmahayana-samgraha\t《摄大乘论》\tMahāyānasaṃgraha\t约4世纪\tsa
candidate-047\tdignaga\t480\t540\tapproximate\tnalanda\t那烂陀\t古代南亚\t25.14\t85.44\t因明\t知觉和推论如何分别提供可靠认识？\t以现量和比量为两类知识来源，并用遍充关系与排除理论分析概念\tindian\tpramana-samuccaya\t《集量论》\tPramāṇasamuccaya\t约6世纪\tsa
candidate-048\tdharmakirti\t600\t660\tapproximate\tnalanda\t那烂陀\t古代南亚\t25.14\t85.44\t刹那因果\t认识的可靠性如何由因果效力加以说明？\t真实对象具有因果效力且刹那生灭，推论通过排除与必然联系形成\tindian\tpramanavarttika\t《释量论》\tPramāṇavārttika\t约7世纪\tsa
candidate-053\tbhartrhari\t450\t510\tapproximate\tujjain\t邬阇衍那\t古代南亚\t23.18\t75.78\t语句整体\t语言意义来自孤立词项还是不可分割的整体理解？\t言语活动以整体闪现的方式呈现意义，语言与意识及世界秩序紧密关联\tindian\tvakyapadiya\t《语句论》\tVākyapadīya\t约5世纪\tsa
candidate-054\tkumarila-bhatta\t650\t725\tapproximate\tprayagraj\t钵罗耶伽\t中世纪南亚\t25.44\t81.85\t吠陀自证\t经典证言为何能够成为独立的知识来源？\t吠陀不依赖个人作者而具有权威，认知在无反证时具有初始可信性\tindian\tsloka-varttika\t《颂评》\tŚlokavārttika\t约7至8世纪\tsa
candidate-055\tjayanta-bhatta\t820\t900\tapproximate\tkashmir\t克什米尔\t中世纪南亚\t34.08\t74.8\t论辩公共性\t哲学论辩如何在多传统社会中判断证据与权威？\t以正理方法检验推论、证言和宗教主张，并讨论法律与公共秩序\tindian\tnyaya-manjari\t《正理花簇》\tNyāyamañjarī\t约9世纪\tsa
candidate-060\trammohan-roy\t1772\t1833\testablished\tkolkata\t加尔各答\t英属印度\t22.57\t88.36\t宗教理性改革\t宗教传统如何在理性批判与社会改革中更新？\t以奥义书一神论和公共论辩反对陋习，推动教育、出版与妇女权利改革\tindian\tprecepts-jesus-roy\t《耶稣的训诫》\tThe Precepts of Jesus\t1820年\ten
candidate-061\tswami-vivekananda\t1863\t1902\testablished\tkolkata\t加尔各答\t近代印度\t22.57\t88.36\t实践吠檀多\t精神解脱如何与服务社会和人类团结相结合？\t每一灵魂具有神性，瑜伽与服务可把吠檀多转化为公共伦理实践\tindian\tjnana-yoga\t《智瑜伽》\tJnana Yoga\t1899年文集\ten
candidate-062\trabindranath-tagore\t1861\t1941\testablished\tshantiniketan\t圣蒂尼克坦\t近代印度\t23.68\t87.68\t关系人文主义\t自由教育如何连接个人创造、自然与世界文化？\t人的实现来自与自然和他者的创造性关系，民族主义不能压倒普遍人性\tindian\treligion-man\t《人的宗教》\tThe Religion of Man\t1931年\ten
candidate-067\tzoroaster\t-1200\t-600\tdisputed\tairyanem-vaejah\t古伊朗东部区域\t古伊朗\t35.0\t62.0\t善思善言善行\t人在善恶冲突中如何承担自由选择的责任？\t真理与谎言的对立要求人以善思善言善行参与维护正义秩序\tislamic\tgathas\t《伽萨》\tGāthās\t年代有争议\tae
candidate-068\tmani\t216\t274\testablished\tctesiphon\t泰西封\t萨珊帝国\t33.09\t44.58\t光暗二元\t世界中的恶与痛苦如何由宇宙性冲突解释？\t光与暗的混合构成现世处境，知识、节制和宗教共同体协助释放光明\tislamic\tshabuhragan\t《沙卜拉干》\tŠābuhragān\t3世纪\tmp
candidate-069\tal-kindi\t801\t873\tapproximate\tbaghdad\t巴格达\t阿拔斯王朝\t33.31\t44.36\t第一哲学\t希腊哲学知识如何进入阿拉伯语思想语境？\t真理不因来源而失效，第一哲学以因果和统一解释世界并服务启示理解\tislamic\ton-first-philosophy\t《论第一哲学》\tFī al-falsafa al-ūlā\t9世纪\tar
candidate-074\tsuhrawardi\t1154\t1191\testablished\taleppo\t阿勒颇\t中世纪西亚\t36.2\t37.16\t光的形上学\t知识能否通过直接临在而不只依赖概念表象？\t照明哲学以光的等级解释存在，并以临在知识连接论证与精神体验\tislamic\tphilosophy-illumination\t《照明哲学》\tḤikmat al-ishrāq\t1186年\tar
candidate-075\tibn-arabi\t1165\t1240\testablished\tdamascus\t大马士革\t中世纪伊斯兰世界\t33.51\t36.29\t存在统一\t无限神圣实在如何在多样世界中显现？\t万物是神圣名号的不同显现，完人以想象和认识综合存在的多重层次\tislamic\tbezels-wisdom\t《智慧珍宝》\tFuṣūṣ al-ḥikam\t1229年\tar
candidate-076\tmulla-sadra\t1571\t1640\tapproximate\tshiraz\t设拉子\t萨法维伊朗\t29.59\t52.58\t存在优先\t存在与本质何者更根本，实体如何发生真实变化？\t存在先于本质并具有强弱层次，实体运动说明自然和灵魂的内在生成\tislamic\tfour-journeys\t《四程》\tal-Asfār al-arbaʿa\t17世纪\tar
candidate-081\tsaadia-gaon\t882\t942\testablished\tbaghdad\t巴格达\t阿拔斯时期犹太社群\t33.31\t44.36\t理性与启示\t理性论证与宗教传统如何相互支持？\t可靠理性可确认创造、灵魂和伦理真理，启示则补充并加速人的认识\tjewish\tbeliefs-opinions\t《信仰与见解之书》\tKitāb al-Amānāt wa-l-Iʿtiqādāt\t933年\tja
candidate-082\tmaimonides\t1138\t1204\testablished\tcairo\t福斯塔特\t中世纪埃及\t30.0\t31.23\t否定神学\t有限语言如何谈论超越属性的神？\t关于神的肯定属性易导致拟人化，否定性表达更能维护神圣统一\tjewish\tguide-perplexed\t《迷途指津》\tDalālat al-ḥāʾirīn\t约1190年\tja
candidate-083\tphilo-alexandria\t-20\t50\tapproximate\talexandria\t亚历山大里亚\t希腊化埃及\t31.2\t29.92\t寓意解释\t经典叙事如何与希腊哲学的理性概念协调？\t寓意解释揭示律法的哲学层次，逻各斯连接超越的神与可理解世界\tjewish\tphilo-works\t《斐洛著作集》\tWorks of Philo\t公元1世纪\tgrc
candidate-088\tmuhammad-iqbal\t1877\t1938\testablished\tlahore\t拉合尔\t英属印度\t31.55\t74.34\t自我强化\t现代穆斯林主体如何在变化世界中获得创造性自由？\t自我不是静止实体，而在行动、爱与责任中增强并参与开放的宇宙进程\tislamic\treconstruction-religious-thought\t《伊斯兰宗教思想的重建》\tThe Reconstruction of Religious Thought in Islam\t1930至1934年\ten
candidate-089\tali-shariati\t1933\t1977\testablished\ttehran\t德黑兰\t现代伊朗\t35.69\t51.39\t革命主体\t宗教传统如何转化为反压迫和社会变革的语言？\t重释什叶派殉难与责任，使被异化者成为反殖民和反专制的行动主体\tislamic\tred-shiism\t《红色什叶派与黑色什叶派》\tRed Shi'ism vs. Black Shi'ism\t1970年代\tfa
candidate-090\tabdolkarim-soroush\t1945\t2026\testablished\ttehran\t德黑兰\t当代伊朗\t35.69\t51.39\t宗教知识变迁\t神圣启示与人类对宗教的历史理解应如何区分？\t宗教本身与可变的宗教知识不同，解释会随科学、社会和认识条件扩展收缩\tislamic\tcontraction-expansion\t《宗教知识的收缩与扩展》\tQabz va Bast-e Teorik-e Shariat\t1990年\tfa
candidate-095\ttalal-asad\t1932\t2026\testablished\tnew-york\t纽约\t当代跨区域学术网络\t40.71\t-74.0\t世俗的谱系\t宗教与世俗是否真是普遍且中立的分类？\t宗教和世俗由特定权力、身体训练与历史制度共同塑造，不能脱离谱系理解\tislamic\tformations-secular\t《世俗的形成》\tFormations of the Secular\t2003年\ten
candidate-096\tseyyed-hossein-nasr\t1933\t2026\testablished\twashington-dc\t华盛顿\t当代伊斯兰思想\t38.91\t-77.04\t神圣知识\t现代科学为何会造成自然世界的意义危机？\t传统形上学把自然理解为神圣秩序，知识应恢复宇宙、伦理和精神的关联\tislamic\tknowledge-sacred\t《知识与神圣》\tKnowledge and the Sacred\t1981年\ten
candidate-097\tthales\t-624\t-546\tapproximate\tmiletus\t米利都\t爱奥尼亚\t37.53\t27.28\t水本原\t自然现象能否由世界内部的共同原理解释？\t后世证言把水视为万物本原，标志以自然原因讨论宇宙秩序的早期尝试\teuropean\tthales-testimonia\t《泰勒斯古代证言》\tAncient testimonia on Thales\t古代证言\tgrc
candidate-102\tempedocles\t-494\t-434\tapproximate\tagrigento\t阿克拉加斯\t大希腊\t37.31\t13.58\t四根爱争\t变化如何在基本成分不生不灭的条件下发生？\t土水气火四根在爱与争的力量下聚散，解释宇宙循环和生命形成\teuropean\tempedocles-fragments\t《恩培多克勒残篇》\tFragments\t公元前5世纪\tgrc
candidate-103\tdemocritus\t-460\t-370\tapproximate\tabdera\t阿布德拉\t古希腊\t40.95\t24.98\t原子与虚空\t复杂世界能否由不可分割的微粒和运动解释？\t原子在虚空中的排列与运动构成可感事物，性质差异不需诉诸目的因\teuropean\tdemocritus-fragments\t《德谟克利特残篇》\tFragments\t公元前5至4世纪\tgrc
candidate-104\tprotagoras\t-490\t-420\tapproximate\tathens\t雅典\t古希腊\t37.98\t23.73\t人是尺度\t真理与政治判断在意见分歧中如何可能？\t人的经验是判断尺度，教育和公共论辩可把较差意见转化为更有利的意见\teuropean\tprotagoras-testimonia\t《普罗泰戈拉证言与残篇》\tTestimonia and fragments\t公元前5世纪\tgrc
candidate-109\tcicero\t-106\t-43\testablished\trome\t罗马\t罗马共和国\t41.9\t12.5\t共和责任\t哲学德性如何服务法律、友谊和共和国？\t自然法与公共责任要求公民把修辞、审慎和正义投入共同体治理\teuropean\ton-duties\t《论义务》\tDe officiis\t公元前44年\tla
candidate-110\tseneca\t-4\t65\tapproximate\trome\t罗马\t罗马帝国\t41.9\t12.5\t时间占有\t人在权力、财富和死亡面前如何保持内在自由？\t分辨可控判断与外在偶然，珍惜有限时间并以理性训练情绪\teuropean\tletters-lucilius\t《致鲁基利乌斯道德书简》\tEpistulae Morales ad Lucilium\t公元1世纪\tla
candidate-111\tepictetus\t50\t135\tapproximate\tnicopolis\t尼科波利斯\t罗马帝国\t39.0\t20.75\t控制二分\t自由是否取决于外部处境还是对判断的掌握？\t把可由我们控制的判断与外在事物区分，是德性和内在自由的基础\teuropean\tenchiridion\t《手册》\tEnchiridion\t2世纪初、阿里安编\tgrc
candidate-116\tanselm-canterbury\t1033\t1109\testablished\tcanterbury\t坎特伯雷\t中世纪英格兰\t51.28\t1.08\t信仰寻求理解\t信仰内容能否通过理性反思获得更清楚的理解？\t信仰推动理性探索，关于最高存在的概念可引导存在论式论证\teuropean\tproslogion\t《宣讲》\tProslogion\t1077至1078年\tla
candidate-117\tpeter-abelard\t1079\t1142\testablished\tparis\t巴黎\t中世纪法国\t48.86\t2.35\t意向伦理\t行动的道德性质主要取决于结果、规则还是行动者意向？\t罪责在于意志对所理解义务的同意，外在行为本身不足以判断伦理\teuropean\tethics-abelard\t《伦理学》\tEthica seu Scito te ipsum\t12世纪\tla
candidate-118\thildegard-bingen\t1098\t1179\testablished\tbingen\t宾根\t中世纪德意志\t49.97\t7.9\t生命力\t自然、身体、音乐与神学想象如何构成统一的知识图景？\t生命力贯穿宇宙和身体，视觉、音乐与自然观察共同表达受造秩序\teuropean\tscivias\t《认识道路》\tScivias\t1151年\tla
candidate-123\terasmus\t1466\t1536\tapproximate\tbasel\t巴塞尔\t文艺复兴欧洲\t47.56\t7.59\t基督教人文主义\t文本校勘与教育如何推动宗教和社会改革？\t回到原典、讽刺僵化权威并培养判断力，可促成温和而持续的改革\teuropean\tpraise-folly\t《愚人颂》\tMoriae encomium\t1511年\tla
candidate-124\tfrancis-bacon\t1561\t1626\testablished\tlondon\t伦敦\t近代英国\t51.51\t-0.13\t归纳与偶像\t知识方法如何克服心智偏见并产生可靠发现？\t系统观察、实验和逐步归纳应取代仓促概括，同时清理四类心智偶像\teuropean\tnovum-organum\t《新工具》\tNovum Organum\t1620年\tla
candidate-125\tblaise-pascal\t1623\t1662\testablished\tparis\t巴黎\t近代法国\t48.86\t2.35\t心的理由\t理性证明的边界如何影响信仰与人生选择？\t人的伟大与悲惨并存，理性有界而习惯、直觉和实践选择参与信念形成\teuropean\tpensees\t《思想录》\tPensées\t1670年后编\tfr
candidate-130\tjohn-stuart-mill\t1806\t1873\testablished\tlondon\t伦敦\t现代英国\t51.51\t-0.13\t伤害原则\t社会何时可以正当地限制个人自由？\t只有防止对他人造成伤害才足以强制干预，个性发展具有公共价值\teuropean\ton-liberty\t《论自由》\tOn Liberty\t1859年\ten
candidate-131\tarthur-schopenhauer\t1788\t1860\testablished\tfrankfurt\t法兰克福\t近代德国\t50.11\t8.68\t意志与表象\t痛苦为何深植于欲求和世界经验之中？\t世界作为表象受认识形式组织，而盲目意志推动无尽欲求与痛苦\teuropean\tworld-will-representation\t《作为意志和表象的世界》\tDie Welt als Wille und Vorstellung\t1818年\tde
candidate-132\tludwig-feuerbach\t1804\t1872\testablished\tberlin\t柏林\t近代德国\t52.52\t13.4\t宗教投射\t神学属性是否表达了被异化的人类能力？\t宗教把人的类本质投射为超越对象，批判应使爱与共同性回到人间\teuropean\tessence-christianity\t《基督教的本质》\tDas Wesen des Christentums\t1841年\tde
candidate-137\tgottlob-frege\t1848\t1925\testablished\tjena\t耶拿\t近代德国\t50.93\t11.59\t涵义与指称\t语言表达式的意义如何超出其所指对象？\t涵义提供对象的呈现方式，指称则是对象本身，区分二者澄清同一性和真值\teuropean\tsense-reference\t《论涵义与指称》\tÜber Sinn und Bedeutung\t1892年\tde
candidate-138\trudolf-carnap\t1891\t1970\testablished\tchicago\t芝加哥\t维也纳学派与美国逻辑经验主义\t41.88\t-87.63\t语言框架\t哲学争论如何通过语言框架与逻辑分析获得澄清？\t许多形上争论源于语言混乱，选择框架应依据清晰性和实践效用\teuropean\tempiricism-semantics-ontology\t《经验主义、语义学与本体论》\tEmpiricism, Semantics, and Ontology\t1950年\ten
candidate-139\tptahhotep\t-2400\t-2350\tdisputed\tmemphis-egypt\t孟斐斯\t古王国埃及\t29.85\t31.25\t玛阿特言行\t良好治理和日常交往如何体现正义秩序？\t克制言语、倾听和公正行政使个人行为与玛阿特的社会宇宙秩序协调\tafrican\tmaxims-ptahhotep\t《普塔霍特普箴言》\tMaxims of Ptahhotep\t古埃及中王国抄本\tegy
candidate-144\tedward-wilmot-blyden\t1832\t1912\testablished\tmonrovia\t蒙罗维亚\t近代西非\t6.3\t-10.8\t非洲人格\t殖民教育如何影响非洲人的文化主体性？\t非洲社会应以自身历史、宗教和制度资源抵抗欧洲中心主义并建立自主教育\tafrican\tchristianity-islam-negro-race\t《基督教、伊斯兰教与黑人种族》\tChristianity, Islam and the Negro Race\t1887年\ten
candidate-145\tafricanus-horton\t1835\t1883\testablished\tfreetown\t弗里敦\t英属西非\t8.48\t-13.23\t西非自治\t种族主义伪科学如何由经验和政治论证反驳？\t非洲人的能力不由种族决定，教育、自治与现代制度可支撑西非国家发展\tafrican\twest-african-countries-peoples\t《西非国家与人民》\tWest African Countries and Peoples\t1868年\ten
candidate-146\tkwame-nkrumah\t1909\t1972\testablished\taccra\t阿克拉\t现代加纳\t5.56\t-0.19\t自觉主义\t非洲社会如何综合多重传统并完成去殖民化？\t自觉主义以平等主义重组非洲、本土伊斯兰与欧洲影响，连接泛非团结和社会主义\tafrican\tconsciencism\t《自觉主义》\tConsciencism\t1964年\ten
candidate-151\tsteve-biko\t1946\t1977\testablished\tking-williams-town\t威廉王城\t南非\t-32.88\t27.39\t黑人意识\t被压迫者如何摆脱内化的种族等级？\t心理解放和黑人团结是政治行动的前提，被压迫者必须重新定义自身价值\tafrican\ti-write-what-i-like\t《我写我所喜欢的》\tI Write What I Like\t1978年文集\ten
candidate-152\tjohn-mbiti\t1931\t2019\testablished\tnairobi\t内罗毕\t现代东非\t-1.29\t36.82\t共同体时间\t非洲宗教观如何理解人格、时间和共同体？\t人格在亲属、祖先和共同体关系中形成，时间经验与仪式实践紧密相连\tafrican\tafrican-religions-philosophy\t《非洲宗教与哲学》\tAfrican Religions and Philosophy\t1969年\ten
candidate-153\tkwasi-wiredu\t1931\t2022\testablished\taccra\t阿克拉\t现代加纳\t5.56\t-0.19\t概念去殖民\t哲学概念如何摆脱殖民语言带来的误导？\t用本土语言检验哲学范畴并发展共识民主，可避免把外来问题误认作普遍问题\tafrican\tcultural-universals-particulars\t《文化普遍性与特殊性》\tCultural Universals and Particulars\t1996年\ten
candidate-158\tsouleymane-bachir-diagne\t1955\t2026\testablished\tdakar\t达喀尔\t当代非洲\t14.72\t-17.47\t翻译哲学\t不同哲学语言如何通过翻译形成开放的普遍性？\t翻译不是复制同一意义，而是在非洲、伊斯兰与欧洲传统之间创造互通\tafrican\topen-to-reason\t《向理性开放》\tOpen to Reason\t2018年\tfr
candidate-159\tifi-amadiume\t1947\t2026\testablished\tnsukka\t恩苏卡\t当代尼日利亚\t6.86\t7.4\t性别制度历史性\t西方性别范畴能否直接解释非洲社会组织？\t殖民前制度中的身份与权力并不总按二元生理性别排列，殖民治理重塑了性别结构\tafrican\tmale-daughters-female-husbands\t《男性女儿、女性丈夫》\tMale Daughters, Female Husbands\t1987年\ten
candidate-160\toyeronke-oyewumi\t1957\t2026\testablished\tstony-brook\t石溪\t当代离散学术网络\t40.91\t-73.12\t性别范畴殖民性\t身体性别为何不应被视为所有社会的首要分类？\t约鲁巴社会的社会等级曾更多依据年龄等关系，殖民知识将西方性别体系普遍化\tafrican\tinvention-women\t《女性的发明》\tThe Invention of Women\t1997年\ten
candidate-165\tralph-waldo-emerson\t1803\t1882\testablished\tconcord\t康科德\t近代美国\t42.46\t-71.35\t自我信赖\t个体如何在传统与社会从众压力中形成独立判断？\t自我信赖要求信任当下直觉，同时通过自然和公共行动超越封闭自我\tamerican\tessays-emerson\t《论文集：第一辑》\tEssays: First Series\t1841年\ten
candidate-166\thenry-david-thoreau\t1817\t1862\testablished\tconcord\t康科德\t近代美国\t42.46\t-71.35\t公民不服从\t个人良知何时应拒绝服从不正义国家？\t当法律使人参与奴役和战争时，撤回合作和承担惩罚可成为政治责任\tamerican\tcivil-disobedience\t《论公民不服从》\tCivil Disobedience\t1849年\ten
candidate-167\tfrederick-douglass\t1818\t1895\testablished\trochester\t罗切斯特\t近代美国\t43.16\t-77.61\t自我解放\t奴役制度如何通过知识控制摧毁人格与自由？\t识字、叙事和集体抗争揭露奴役的暴力，使被奴役者成为自由的政治主体\tamerican\tnarrative-douglass\t《弗雷德里克·道格拉斯生平叙事》\tNarrative of the Life of Frederick Douglass\t1845年\ten
candidate-172\tw-v-o-quine\t1908\t2000\testablished\tharvard\t哈佛大学\t现代美国\t42.38\t-71.12\t确认整体论\t单个命题能否独立面对经验检验？\t知识体系整体承受经验压力，分析与综合及理论与观察之间没有绝对边界\tamerican\ttwo-dogmas\t《经验主义的两个教条》\tTwo Dogmas of Empiricism\t1951年\ten
candidate-173\tthomas-kuhn\t1922\t1996\testablished\tprinceton\t普林斯顿\t现代美国\t40.35\t-74.66\t范式转换\t科学知识是否只通过连续积累而发展？\t常规科学在范式内解决难题，危机与革命则改变问题、标准和世界图景\tamerican\tstructure-scientific-revolutions\t《科学革命的结构》\tThe Structure of Scientific Revolutions\t1962年\ten
candidate-174\tjudith-butler\t1956\t2026\testablished\tberkeley\t伯克利\t当代美国\t37.87\t-122.27\t性别操演\t性别身份如何由重复规范产生又可能被改变？\t性别不是内在本质，而由受规训的重复行动构成，重复也为偏移和抵抗留下空间\tamerican\tgender-trouble\t《性别麻烦》\tGender Trouble\t1990年\ten
candidate-179\tedouard-glissant\t1928\t2011\testablished\tmartinique\t马提尼克\t加勒比\t14.64\t-61.02\t关系诗学\t文化身份如何在迁徙、混杂和不可透明性中形成？\t关系身份不依赖单一根源，并以不透明权抵抗把他者完全化约为同一标准\tlatin\tpoetics-relation\t《关系诗学》\tPoétique de la Relation\t1990年\tfr
candidate-180\tc-l-r-james\t1901\t1989\testablished\tport-of-spain\t西班牙港\t加勒比\t10.66\t-61.51\t群众自我活动\t殖民革命如何由普通人的集体行动推动？\t被殖民者不是精英领导的被动对象，劳动、文化和群众组织具有自主创造力\tlatin\tblack-jacobins\t《黑色雅各宾派》\tThe Black Jacobins\t1938年\ten
candidate-181\taime-cesaire\t1913\t2008\testablished\tmartinique\t马提尼克\t加勒比\t14.64\t-61.02\t殖民物化\t殖民主义如何同时损害被殖民者和殖民社会？\t殖民统治把人化约为物并使欧洲文明野蛮化，去殖民必须恢复主体与历史\tlatin\tdiscourse-colonialism\t《论殖民主义》\tDiscours sur le colonialisme\t1950年\tfr
candidate-186\tanibal-quijano\t1930\t2018\testablished\tlima\t利马\t当代拉丁美洲\t-12.05\t-77.04\t权力殖民性\t殖民统治结束后，种族与知识等级为何仍持续？\t资本主义现代性以种族分类组织劳动、权威和知识，殖民性延续于独立国家\tlatin\tcoloniality-power\t《权力的殖民性、欧洲中心主义与拉丁美洲》\tColoniality of Power, Eurocentrism, and Latin America\t2000年\tes
candidate-187\tmaria-lugones\t1944\t2020\testablished\tbinghamton\t宾厄姆顿\t当代美洲\t42.1\t-75.92\t殖民性别体系\t殖民权力如何重塑性别、种族和劳动关系？\t现代殖民性别体系把欧洲二元性别强加于被殖民社会，抵抗来自关系性世界建构\tlatin\tcolonial-modern-gender\t《异性主义与殖民现代性别体系》\tHeterosexualism and the Colonial/Modern Gender System\t2007年\ten
candidate-188\tcharles-w-mills\t1951\t2021\testablished\tnew-york\t纽约\t当代美国\t40.71\t-74.0\t种族契约\t自由主义社会契约为何长期排除非白人群体？\t种族契约把白人优势写入制度和认识规范，揭示理想理论忽略的现实支配\tamerican\tracial-contract\t《种族契约》\tThe Racial Contract\t1997年\ten
candidate-193\tjose-rizal\t1861\t1896\testablished\tmanila\t马尼拉\t殖民时期菲律宾\t14.6\t120.98\t殖民启蒙\t殖民压迫如何通过教育、小说和历史批判被揭露？\t知识和公共写作揭示教会与殖民权力的腐败，民族尊严需以改革和记忆重建\tsoutheast_asia\tnoli-me-tangere\t《不许犯我》\tNoli Me Tángere\t1887年\tes
candidate-194\tapolinario-mabini\t1864\t1903\testablished\tmanila\t马尼拉\t菲律宾革命时期\t14.6\t120.98\t革命宪政\t民族独立如何转化为负责任的共和制度？\t革命必须由公民德性、法治和人民主权约束，不能以新精英统治取代殖民统治\tsoutheast_asia\ttrue-decalogue\t《真正的十诫》\tEl Verdadero Decálogo\t1898年\tes
candidate-195\tki-hajar-dewantara\t1889\t1959\testablished\tyogyakarta\t日惹\t现代印度尼西亚\t-7.8\t110.37\t教育自主\t殖民教育如何转化为民族自主和人格成长？\t教育者应在前引导、中间共创、后方支持，使学生在文化环境中自由成长\tsoutheast_asia\ttaman-siswa-principles\t《学生园教育原则》\tTaman Siswa educational principles\t20世纪上半叶\tid
candidate-200\tepeli-hauofa\t1939\t2009\testablished\tsuva\t苏瓦\t太平洋地区\t-18.14\t178.44\t岛海共同体\t太平洋岛屿为何不应被想象成孤立而微小？\t海洋连接而非分割岛屿，迁徙、亲属和交换构成广阔的区域共同体\tindigenous\tour-sea-islands\t《我们的岛屿之海》\tOur Sea of Islands\t1993年\ten
candidate-201\tedward-said\t1935\t2003\testablished\tnew-york\t纽约\t跨区域离散传统\t40.71\t-74.0\t东方主义\t知识表述如何参与帝国对他者的治理？\t东方主义以制度化表述生产可支配的东方对象，批评应追踪知识与权力的关系\tcultural_studies\torientalism\t《东方学》\tOrientalism\t1978年\ten
candidate-202\tgayatri-chakravorty-spivak\t1942\t2026\testablished\tnew-york\t纽约\t跨区域离散传统\t40.71\t-74.0\t底层能否发声\t代表被压迫者的知识实践为何可能再次遮蔽其声音？\t底层主体受多重制度中介，批评者必须反思自身代表位置和认识暴力\tcultural_studies\tcan-subaltern-speak\t《底层能发声吗？》\tCan the Subaltern Speak?\t1988年\ten
candidate-207\tjudith-shklar\t1928\t1992\testablished\tharvard\t哈佛大学\t离散与现代政治思想\t42.38\t-71.12\t恐惧自由主义\t政治制度首先应避免哪一种可预见的恶？\t自由主义的最低共同点是防止国家残酷和恐惧，因为弱者最易承受制度伤害\tamerican\tliberalism-fear\t《恐惧的自由主义》\tThe Liberalism of Fear\t1989年\ten
candidate-208\tmartha-nussbaum\t1947\t2026\testablished\tchicago\t芝加哥\t当代伦理与政治哲学\t41.88\t-87.63\t核心能力\t正义制度应保障每个人具备哪些真实生活机会？\t能力进路以人的实际选择和行动机会评价发展，并设定尊严所需的核心门槛\tamerican\tfrontiers-justice\t《正义的前沿》\tFrontiers of Justice\t2006年\ten
candidate-209\tkwame-anthony-appiah\t1954\t2026\testablished\tnew-york\t纽约\t当代世界主义\t40.71\t-74.0\t扎根世界主义\t全球责任如何与地方身份和文化差异共存？\t世界主义结合对所有人的义务与对具体生活方式的尊重，身份不是封闭本质\tafrican\tcosmopolitanism-appiah\t《世界主义》\tCosmopolitanism\t2006年\ten
`;

export const RELEASE_210_ADDITIONS = RAW_RELEASE_210_ADDITIONS.trim().split("\n").map((line) => {
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
