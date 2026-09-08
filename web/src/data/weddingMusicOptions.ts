export type WeddingStyleOption = {
  id: string
  zhLabel: string
  enLabel: string
  zhDescription: string
  enDescription: string
}

export type VocalOption = {
  code: string
  zhLabel: string
  enLabel: string
  zhDescription: string
  enDescription: string
}

export const weddingStyleOptions: WeddingStyleOption[] = [
  {
    id: 'soft_pop',
    zhLabel: '温柔流行',
    enLabel: 'Soft Pop',
    zhDescription: '适合迎宾、入场和轻甜婚礼氛围。',
    enDescription: 'Gentle and polished for entrances and romantic receptions.',
  },
  {
    id: 'proposal_confession_pop',
    zhLabel: '求婚告白流行',
    enLabel: 'Proposal Confession Pop',
    zhDescription: '适合求婚现场：从心动到“嫁给我/娶我”的情绪推进。',
    enDescription: 'Built for proposals: a steady build from confession to “will you marry me”.',
  },
  {
    id: 'proposal_piano_serenade',
    zhLabel: '求婚钢琴独奏',
    enLabel: 'Proposal Piano Serenade',
    zhDescription: '适合单膝求婚与惊喜告白，干净克制、氛围感强。',
    enDescription: 'Clean piano-led serenade for kneeling moments and surprise proposals.',
  },
  {
    id: 'proposal_cinematic_build',
    zhLabel: '求婚电影感推进',
    enLabel: 'Proposal Cinematic Build',
    zhDescription: '像电影告白高潮，适合视频回顾与灯光氛围的求婚仪式。',
    enDescription: 'Cinematic build-up for proposal highlights and dramatic moments.',
  },
  {
    id: 'proposal_acoustic_serenade',
    zhLabel: '求婚木吉他清唱',
    enLabel: 'Acoustic Proposal Serenade',
    zhDescription: '温暖真诚，像在她/他耳边唱情话，适合户外求婚。',
    enDescription: 'Warm acoustic serenade, intimate and sincere for outdoor proposals.',
  },
  {
    id: 'romantic_ballad',
    zhLabel: '浪漫抒情',
    enLabel: 'Romantic Ballad',
    zhDescription: '适合誓言、求婚回顾和高情绪时刻。',
    enDescription: 'Emotional and heartfelt for vows and cinematic moments.',
  },
  {
    id: 'sweet_pop',
    zhLabel: '甜蜜甜歌',
    enLabel: 'Sweet Pop',
    zhDescription: '适合年轻、可爱、恋爱感很强的新人。',
    enDescription: 'Bright and playful for youthful, affectionate couples.',
  },
  {
    id: 'acoustic_folk',
    zhLabel: '木吉他民谣',
    enLabel: 'Acoustic Folk',
    zhDescription: '像海外草坪婚礼，温暖自然，适合户外仪式。',
    enDescription: 'Warm and organic for garden weddings and outdoor ceremonies.',
  },
  {
    id: 'piano_ballad',
    zhLabel: '钢琴情歌',
    enLabel: 'Piano Ballad',
    zhDescription: '干净纯粹，适合婚礼开场与父母致辞片段。',
    enDescription: 'Clean and elegant for opening films and family moments.',
  },
  {
    id: 'jazz_swing',
    zhLabel: '爵士摇摆',
    enLabel: 'Jazz Swing',
    zhDescription: '带一点复古派对感，适合酒会和晚宴。',
    enDescription: 'Vintage and classy for cocktail hours and dinner sets.',
  },
  {
    id: 'soul_rnb',
    zhLabel: 'Soul / R&B',
    enLabel: 'Soul / R&B',
    zhDescription: '更时尚性感，适合都市婚礼和夜场氛围。',
    enDescription: 'Stylish and smooth for modern city weddings.',
  },
  {
    id: 'motown_love',
    zhLabel: '摩城情歌',
    enLabel: 'Motown Love',
    zhDescription: '经典婚礼常用风格，复古又有庆典感。',
    enDescription: 'Classic wedding energy with vintage soul and celebration.',
  },
  {
    id: 'country_waltz',
    zhLabel: '乡村华尔兹',
    enLabel: 'Country Waltz',
    zhDescription: '适合户外、庄园、牧场婚礼，画面感很强。',
    enDescription: 'Perfect for ranch, estate and countryside weddings.',
  },
  {
    id: 'latin_romance',
    zhLabel: '拉丁浪漫',
    enLabel: 'Latin Romance',
    zhDescription: '热情又有节奏，适合热烈、欢庆的婚礼现场。',
    enDescription: 'Warm and rhythmic for lively, celebratory weddings.',
  },
  {
    id: 'bossa_nova',
    zhLabel: '巴萨诺瓦',
    enLabel: 'Bossa Nova',
    zhDescription: '轻松高级，适合海边婚礼和香槟酒会。',
    enDescription: 'Relaxed and refined for seaside weddings and chic receptions.',
  },
  {
    id: 'bollywood_romance',
    zhLabel: '宝莱坞浪漫',
    enLabel: 'Bollywood Romance',
    zhDescription: '情绪浓烈、旋律华丽，适合印度婚礼语境。',
    enDescription: 'Dramatic and melodic for South Asian wedding moods.',
  },
  {
    id: 'punjabi_bhangra_wedding',
    zhLabel: '旁遮普 Bhangra',
    enLabel: 'Punjabi Bhangra',
    zhDescription: '高能鼓点与庆典舞步，适合印度/巴基斯坦婚礼派对氛围。',
    enDescription: 'High-energy dhol-driven celebration for South Asian wedding dance floors.',
  },
  {
    id: 'kpop_love',
    zhLabel: 'K-Pop 告白',
    enLabel: 'K-Pop Love',
    zhDescription: '清新精致，适合韩式婚礼与年轻潮流审美。',
    enDescription: 'Fresh and polished for trendy Korean-inspired weddings.',
  },
  {
    id: 'jpop_wedding',
    zhLabel: 'J-Pop 婚礼歌',
    enLabel: 'J-Pop Wedding',
    zhDescription: '温暖治愈，适合日系轻婚礼和纯爱感。',
    enDescription: 'Tender and uplifting for Japanese-style romance.',
  },
  {
    id: 'jpop_citypop_romance',
    zhLabel: '日系 City Pop 浪漫',
    enLabel: 'Japanese City Pop Romance',
    zhDescription: '复古霓虹与轻快律动，适合日系派对与轻松婚礼。',
    enDescription: 'Retro city-pop groove for Japanese-inspired chic receptions.',
  },
  {
    id: 'french_chanson',
    zhLabel: '法式香颂',
    enLabel: 'French Chanson',
    zhDescription: '轻奢浪漫，适合法式晚宴和艺术感婚礼。',
    enDescription: 'Elegant and charming for Parisian-inspired weddings.',
  },
  {
    id: 'oriental_romance',
    zhLabel: '国风浪漫',
    enLabel: 'Oriental Romance',
    zhDescription: '适合中式婚礼、敬茶和传统仪式感。',
    enDescription: 'Graceful and ceremonial for Chinese-style weddings.',
  },
  {
    id: 'cantopop_classic',
    zhLabel: '港风经典情歌',
    enLabel: 'Cantopop Classic',
    zhDescription: '像香港经典婚礼情歌，怀旧又高级。',
    enDescription: 'Nostalgic and polished like a classic Hong Kong love song.',
  },
  {
    id: 'minnan_ballad',
    zhLabel: '闽南语怀旧情歌',
    enLabel: 'Minnan Love Ballad',
    zhDescription: '适合台湾家庭婚礼，亲切、有故事感。',
    enDescription: 'Warm and nostalgic for Taiwanese family celebrations.',
  },
  {
    id: 'gospel_choir',
    zhLabel: '福音诗班',
    enLabel: 'Gospel Choir',
    zhDescription: '庄严又振奋，适合教堂婚礼和誓言交换。',
    enDescription: 'Powerful and uplifting for church weddings and blessings.',
  },
  {
    id: 'arabic_dabke_wedding',
    zhLabel: '中东 Dabke 庆典',
    enLabel: 'Middle Eastern Dabke',
    zhDescription: '强节奏合跳民舞氛围，适合阿拉伯婚礼的热烈庆典与进场。',
    enDescription: 'Energetic dabke grooves for Middle Eastern wedding celebrations and entrances.',
  },
  {
    id: 'arabic_pop_romance',
    zhLabel: '阿拉伯流行情歌',
    enLabel: 'Arabic Pop Romance',
    zhDescription: '旋律婉转、节奏明快，适合中东/北非的现代婚礼氛围。',
    enDescription: 'Melodic and rhythmic modern Arabic pop for festive weddings.',
  },
  {
    id: 'afrobeats_wedding',
    zhLabel: 'Afrobeats 婚礼派对',
    enLabel: 'Afrobeats Wedding',
    zhDescription: '西非风格律动，适合热闹婚礼派对与全场合唱。',
    enDescription: 'Afrobeats groove for joyful, high-energy wedding parties.',
  },
  {
    id: 'amapiano_romance',
    zhLabel: 'Amapiano 浪漫律动',
    enLabel: 'Amapiano Romance',
    zhDescription: '南非标志性低频律动，更松弛、更高级的夜场婚礼气质。',
    enDescription: 'South African amapiano vibe: relaxed, modern and stylish for late-night receptions.',
  },
  {
    id: 'celtic_ceilidh_wedding',
    zhLabel: '凯尔特 Ceilidh 舞会',
    enLabel: 'Celtic Ceilidh',
    zhDescription: '风笛/小提琴的欢快合舞，适合苏格兰/爱尔兰主题婚礼。',
    enDescription: 'Fiddles and bagpipes for lively Celtic ceilidh-style dancing.',
  },
  {
    id: 'mariachi_serenade',
    zhLabel: '墨西哥 Mariachi 求婚',
    enLabel: 'Mariachi Serenade',
    zhDescription: '小号与弦乐的浪漫即兴，适合拉美求婚与婚礼祝酒。',
    enDescription: 'Romantic mariachi-style serenade for Latin proposals and celebrations.',
  },
  {
    id: 'cinematic_orchestra',
    zhLabel: '电影配乐感',
    enLabel: 'Cinematic Orchestra',
    zhDescription: '大气、像电影高潮，适合婚礼短片和压轴。',
    enDescription: 'Epic and sweeping for films, trailers and grand finales.',
  },
]

export const vocalOptions: VocalOption[] = [
  {
    code: 'female',
    zhLabel: '女声',
    enLabel: 'Female Vocal',
    zhDescription: '柔美细腻，适合大多数浪漫婚礼歌曲。',
    enDescription: 'Soft and graceful, ideal for romantic wedding songs.',
  },
  {
    code: 'male',
    zhLabel: '男声',
    enLabel: 'Male Vocal',
    zhDescription: '稳重深情，适合誓言感和告白感更强的歌曲。',
    enDescription: 'Warm and grounded, great for vow-like storytelling.',
  },
  {
    code: 'duet',
    zhLabel: '男女对唱',
    enLabel: 'Male & Female Duet',
    zhDescription: '更像新人对唱，适合互动感和故事线更强的作品。',
    enDescription: 'Perfect for couple-style call and response storytelling.',
  },
  {
    code: 'child',
    zhLabel: '童声',
    enLabel: 'Child Vocal',
    zhDescription: '纯净梦幻，适合轻甜、童话感、家庭感婚礼主题。',
    enDescription: 'Pure and dreamy for fairytale and family-themed weddings.',
  },
]
