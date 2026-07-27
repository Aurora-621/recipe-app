#!/usr/bin/env python3
"""
食遇日记风格 · 家庭食谱 App 后端
功能:博主食谱库、个人食谱本、复刻收藏、本周菜单、家庭协作
"""
import os
import json
import uuid
import copy
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=None)
CORS(app)

# 数据存储目录
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
DB_FILE = os.path.join(DATA_DIR, 'db.json')

def load_db():
    """加载数据库,不存在则初始化内置数据"""
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # 兼容旧数据:如果没有 bloggers 表,初始化
            if 'bloggers' not in data:
                data['bloggers'] = {}
                data = init_built_in_data(data)
            return data

    # 初始化全新数据库
    data = {
        'users': {},
        'families': {},
        'recipes': {},
        'weekly_menu': {},
        'sessions': {},
        'bloggers': {},
        'collections': {}  # user -> {recipe_id: collected_at}
    }
    data = init_built_in_data(data)
    return data

def save_db(data):
    """保存数据库"""
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def init_built_in_data(data):
    """初始化内置博主和食谱"""
    if 'bloggers' not in data:
        data['bloggers'] = {}
    if 'recipes' not in data:
        data['recipes'] = {}

    # 内置博主
    bloggers = [
        {
            'id': 'cunlv',
            'name': '村驴厨房',
            'avatar': '🐴',
            'desc': '抖音爆款家常菜博主,做法接地气,成功率极高',
            'platform': '抖音',
            'tags': ['家常菜', '下饭', '快手']
        },
        {
            'id': 'lvxiaochu',
            'name': '吕小厨',
            'avatar': '👨‍🍳',
            'desc': '东北菜、家常菜,步骤详细,适合新手',
            'platform': '抖音',
            'tags': ['东北菜', '家常菜', '硬菜']
        },
        {
            'id': 'system',
            'name': '官方推荐',
            'avatar': '🍳',
            'desc': '精选人气食谱,每日更新',
            'platform': '系统',
            'tags': ['热门', '经典']
        }
    ]
    for b in bloggers:
        if b['id'] not in data['bloggers']:
            data['bloggers'][b['id']] = {**b, 'recipe_count': 0}

    # 内置食谱(村驴厨房 + 吕小厨)
    built_in_recipes = [
        # 村驴厨房
        {
            'id': 'cunlv_001',
            'name': '老妈蹄花',
            'category': '汤品',
            'tags': ['猪蹄', '川菜', '滋补', '家常菜'],
            'blogger_id': 'cunlv',
            'blogger_name': '村驴厨房',
            'image': '🐷',
            'cook_time': '120分钟',
            'difficulty': '中等',
            'servings': 4,
            'ingredients': ['猪蹄 2只', '白芸豆 100g', '生姜 1块', '大葱 2段', '料酒 2勺', '花椒 20粒', '盐 适量', '蘸水(辣椒油/生抽/醋/蒜末)'],
            'steps': [
                '猪蹄用火枪烧去杂毛,盐醋搓洗去腥,清水冲洗干净',
                '冷水下锅,加姜片、料酒焯水5分钟,捞出用温水洗净',
                '白芸豆提前一晚泡发',
                '猪蹄放入砂锅,加足量开水、姜片、葱段、花椒',
                '大火煮开转小火炖90分钟,加入泡好的白芸豆继续炖30分钟',
                '出锅前加盐调味,配蘸水食用'
            ],
            'notes': '汤色奶白的关键:开水下锅、大火煮开转小火慢炖。蘸水是灵魂。'
        },
        {
            'id': 'cunlv_002',
            'name': '酱黄瓜腌黄瓜',
            'category': '凉菜',
            'tags': ['腌菜', '下饭', '快手'],
            'blogger_id': 'cunlv',
            'blogger_name': '村驴厨房',
            'image': '🥒',
            'cook_time': '20分钟+腌制一夜',
            'difficulty': '简单',
            'servings': 2,
            'ingredients': ['黄瓜 2根', '白糖 2勺', '生抽 3勺', '陈醋 2勺', '蚝油 1勺', '蒜末 适量', '小米辣 3个', '花椒油 1勺'],
            'steps': [
                '黄瓜切条去瓤,加白糖杀水20分钟,挤干水分',
                '调酱汁:生抽、陈醋、蚝油、蒜末、小米辣、花椒油搅匀',
                '黄瓜放入密封盒,倒入酱汁拌匀',
                '冷藏腌制一夜即可食用,嘎嘣脆嫩'
            ],
            'notes': '去瓤和杀水是关键,吃起来才脆。'
        },
        {
            'id': 'cunlv_003',
            'name': '风味茄子',
            'category': '素菜',
            'tags': ['茄子', '下饭', '鲁菜'],
            'blogger_id': 'cunlv',
            'blogger_name': '村驴厨房',
            'image': '🍆',
            'cook_time': '30分钟',
            'difficulty': '中等',
            'servings': 3,
            'ingredients': ['长茄子 2根', '玉米淀粉 适量', '蒜 4瓣', '干辣椒 10个', '花椒 1小把', '生抽 2勺', '陈醋 2勺', '白糖 1勺', '盐 少许'],
            'steps': [
                '茄子去瓤切菱形块,清水泡5分钟防氧化',
                '沥干水分,分三次加玉米淀粉抓匀挂糊',
                '油温180度初炸定型,升高油温复炸至金黄酥脆',
                '锅留底油,爆香蒜末、干辣椒、花椒',
                '倒入料汁(生抽/陈醋/糖/盐)熬至粘稠',
                '下茄子快速翻匀出锅'
            ],
            'notes': '一定要复炸,外酥里嫩。料汁不要太多,不然不脆。'
        },
        {
            'id': 'cunlv_004',
            'name': '爆汁牛肉大蒸饺',
            'category': '面食',
            'tags': ['饺子', '牛肉', '主食'],
            'blogger_id': 'cunlv',
            'blogger_name': '村驴厨房',
            'image': '🥟',
            'cook_time': '60分钟',
            'difficulty': '中等',
            'servings': 4,
            'ingredients': ['牛肉馅 300g', '洋葱 半个', '葱姜水 半碗', '花椒 20粒', '生抽 2勺', '老抽 1勺', '蚝油 1勺', '香油 1勺', '饺子皮 30张'],
            'steps': [
                '花椒热水泡出麻香,过滤出花椒水晾凉',
                '牛肉馅分次打入葱姜水和花椒水,每次搅打上劲',
                '洋葱切碎,用香油拌匀锁水',
                '肉馅加生抽、老抽、蚝油调味,加入洋葱拌匀',
                '包饺子,上锅大火蒸15分钟即可'
            ],
            'notes': '打水是关键,咬一口爆汁。'
        },
        {
            'id': 'cunlv_005',
            'name': '小酥肉',
            'category': '肉类',
            'tags': ['猪肉', '油炸', '火锅'],
            'blogger_id': 'cunlv',
            'blogger_name': '村驴厨房',
            'image': '🥩',
            'cook_time': '40分钟',
            'difficulty': '简单',
            'servings': 3,
            'ingredients': ['猪里脊 300g', '红薯淀粉 100g', '鸡蛋 1个', '花椒 15粒', '葱姜 适量', '料酒 1勺', '盐 适量'],
            'steps': [
                '猪里脊切条,加葱姜、料酒、盐腌制20分钟',
                '花椒干锅炒香碾碎,加入肉中',
                '红薯淀粉加鸡蛋、少量水调成酸奶状糊',
                '肉条裹糊,油温160度炸至金黄捞出',
                '油温升高复炸30秒,更酥脆'
            ],
            'notes': '红薯淀粉+鸡蛋是酥脆的关键,可以直接吃或涮火锅。'
        },
        {
            'id': 'cunlv_006',
            'name': '清炖牛肋条',
            'category': '肉类',
            'tags': ['牛肉', '汤菜', '滋补'],
            'blogger_id': 'cunlv',
            'blogger_name': '村驴厨房',
            'image': '🍖',
            'cook_time': '150分钟',
            'difficulty': '简单',
            'servings': 4,
            'ingredients': ['牛肋条 500g', '苹果 半个', '当归 2片', '生姜 1块', '大葱 1段', '料酒 2勺', '盐 适量'],
            'steps': [
                '牛肋条冷水缓化解冻,温水焯水涮净',
                '放入砂锅,加足量开水、姜片、葱段、料酒',
                '加苹果和当归去腥增香',
                '大火烧开转小火炖2小时',
                '出锅前加盐调味,汤清肉烂'
            ],
            'notes': '苹果和当归是秘诀,去腥提鲜。'
        },
        {
            'id': 'cunlv_007',
            'name': '海鲜砂锅粥',
            'category': '主食',
            'tags': ['海鲜', '粥', '潮汕'],
            'blogger_id': 'cunlv',
            'blogger_name': '村驴厨房',
            'image': '🦐',
            'cook_time': '45分钟',
            'difficulty': '中等',
            'servings': 3,
            'ingredients': ['大米 100g', '虾 8只', '干贝 10粒', '干香菇 3朵', '姜丝 适量', '花生酱 1勺', '盐 适量', '白胡椒粉 少许'],
            'steps': [
                '大米提前冷冻2小时,干贝香菇泡发',
                '大米干焙增香,砂锅中加开水下米',
                '虾头炒出虾油,加入粥中',
                '小火煮20分钟至浓稠,加花生酱更顺滑',
                '加入虾肉、干贝、香菇煮5分钟',
                '加盐、白胡椒调味,撒姜丝'
            ],
            'notes': '冷冻米+开水=开花快,虾头油是鲜味的关键。'
        },
        {
            'id': 'cunlv_008',
            'name': '照烧鸡腿饭',
            'category': '午餐',
            'tags': ['鸡肉', '便当', '日式'],
            'blogger_id': 'cunlv',
            'blogger_name': '村驴厨房',
            'image': '🍗',
            'cook_time': '25分钟',
            'difficulty': '简单',
            'servings': 2,
            'ingredients': ['鸡腿 2个', '生抽 2勺', '老抽 半勺', '蚝油 1勺', '蜂蜜 1勺', '料酒 1勺', '清水 3勺', '西兰花 适量', '米饭 1碗'],
            'steps': [
                '鸡腿去骨,刀背拍松,加盐黑胡椒腌制10分钟',
                '调照烧汁:生抽/老抽/蚝油/蜂蜜/料酒/清水搅匀',
                '鸡皮朝下煎至金黄,翻面煎熟',
                '倒入照烧汁小火焖煮至汤汁浓稠',
                '切块铺在米饭上,配焯水西兰花'
            ],
            'notes': '鸡皮先煎出油,皮脆肉嫩。'
        },

        # 吕小厨
        {
            'id': 'lv_001',
            'name': '锅包肉',
            'category': '肉类',
            'tags': ['东北菜', '猪肉', '硬菜'],
            'blogger_id': 'lvxiaochu',
            'blogger_name': '吕小厨',
            'image': '🥓',
            'cook_time': '40分钟',
            'difficulty': '中等',
            'servings': 3,
            'ingredients': ['猪里脊 300g', '土豆淀粉 150g', '胡萝卜丝 少许', '葱丝 少许', '香菜 少许', '白糖 3勺', '白醋 3勺', '生抽 半勺', '盐 少许'],
            'steps': [
                '猪里脊切厚片,加盐、料酒腌制',
                '土豆淀粉加水浸泡,倒掉上层清水,用湿淀粉裹肉',
                '油温180度炸至金黄定型,升高油温复炸',
                '糖醋汁按1:1比例调好,下锅熬至冒泡',
                '倒入肉片和配菜快速翻匀出锅'
            ],
            'notes': '必须用土豆淀粉,才有外酥里嫩的口感。'
        },
        {
            'id': 'lv_002',
            'name': '地三鲜',
            'category': '素菜',
            'tags': ['东北菜', '下饭', '经典'],
            'blogger_id': 'lvxiaochu',
            'blogger_name': '吕小厨',
            'image': '🥔',
            'cook_time': '30分钟',
            'difficulty': '简单',
            'servings': 3,
            'ingredients': ['土豆 1个', '茄子 1根', '青椒 1个', '蒜末 适量', '生抽 2勺', '老抽 半勺', '蚝油 1勺', '白糖 半勺', '淀粉 1勺'],
            'steps': [
                '土豆切块,茄子切滚刀块,青椒切块',
                '茄子裹一层淀粉,油温180度炸软',
                '土豆炸至金黄,青椒过油10秒',
                '锅留底油爆香蒜末,倒入料汁熬稠',
                '下三鲜快速翻匀,让每块都裹上酱汁'
            ],
            'notes': '东北经典下饭菜,料汁要略咸一点才够味。'
        },
        {
            'id': 'lv_003',
            'name': '小鸡炖蘑菇',
            'category': '肉类',
            'tags': ['东北菜', '鸡肉', '炖菜'],
            'blogger_id': 'lvxiaochu',
            'blogger_name': '吕小厨',
            'image': '🍄',
            'cook_time': '90分钟',
            'difficulty': '中等',
            'servings': 4,
            'ingredients': ['鸡腿 2个', '榛蘑 50g', '粉条 1把', '葱姜 适量', '八角 2个', '生抽 2勺', '老抽 1勺', '料酒 2勺', '盐 适量'],
            'steps': [
                '榛蘑温水泡发,鸡腿剁块焯水',
                '锅中放油,鸡块炒干水分至微黄',
                '加葱姜八角炒香,加料酒、生抽、老抽调色',
                '倒入泡蘑菇的水(沉淀后的上层)和开水',
                '大火烧开转小火炖40分钟,加蘑菇和粉条再炖20分钟',
                '加盐调味,汤汁浓稠即可'
            ],
            'notes': '榛蘑是灵魂,泡蘑菇的水千万别倒掉。'
        },
        {
            'id': 'lv_004',
            'name': '酸菜白肉血肠',
            'category': '肉类',
            'tags': ['东北菜', '猪肉', '炖菜'],
            'blogger_id': 'lvxiaochu',
            'blogger_name': '吕小厨',
            'image': '🥬',
            'cook_time': '80分钟',
            'difficulty': '中等',
            'servings': 4,
            'ingredients': ['五花肉 300g', '酸菜 500g', '血肠 1根', '葱姜 适量', '八角 2个', '花椒 10粒', '盐 适量', '白胡椒粉 少许'],
            'steps': [
                '五花肉整块冷水下锅,加葱姜料酒煮30分钟至断生',
                '取出切片,肉汤留用',
                '酸菜切丝洗净攥干水分',
                '锅中爆香葱姜八角花椒,炒酸菜出香味',
                '倒入肉汤和五花肉片炖20分钟',
                '放入血肠煮5分钟,撒白胡椒出锅'
            ],
            'notes': '东北过年菜,酸香开胃,血肠最后放防止煮老。'
        },
        {
            'id': 'lv_005',
            'name': '溜肉段',
            'category': '肉类',
            'tags': ['东北菜', '猪肉', '下饭'],
            'blogger_id': 'lvxiaochu',
            'blogger_name': '吕小厨',
            'image': '🥩',
            'cook_time': '35分钟',
            'difficulty': '中等',
            'servings': 3,
            'ingredients': ['猪里脊 300g', '青椒 1个', '土豆淀粉 100g', '生抽 2勺', '蚝油 1勺', '白糖 半勺', '醋 半勺', '蒜末 适量'],
            'steps': [
                '里脊切骰子块,土豆淀粉加水泡开后抓匀挂糊',
                '油温180度炸至金黄,复炸一次更酥脆',
                '青椒切块过油',
                '调碗芡:生抽/蚝油/糖/醋/淀粉/水搅匀',
                '爆香蒜末,下肉段青椒,倒入碗芡快速翻匀'
            ],
            'notes': '咸鲜口,外酥里嫩,和锅包肉并称东北两绝。'
        },

        # 官方推荐
        {
            'id': 'sys_001',
            'name': '番茄炒蛋',
            'category': '午餐',
            'tags': ['家常菜', '快手', '下饭'],
            'blogger_id': 'system',
            'blogger_name': '官方推荐',
            'image': '🍅',
            'cook_time': '15分钟',
            'difficulty': '简单',
            'servings': 2,
            'ingredients': ['番茄 2个', '鸡蛋 3个', '盐 适量', '糖 1勺', '葱花 少许'],
            'steps': [
                '番茄切块,鸡蛋打散',
                '热油炒熟鸡蛋盛出',
                '锅中炒番茄出汁,倒回鸡蛋翻炒',
                '加盐、糖调味,撒葱花出锅'
            ],
            'notes': '番茄选熟透的,加糖提鲜。'
        },
        {
            'id': 'sys_002',
            'name': '红烧肉',
            'category': '晚餐',
            'tags': ['猪肉', '经典', '硬菜'],
            'blogger_id': 'system',
            'blogger_name': '官方推荐',
            'image': '🥓',
            'cook_time': '90分钟',
            'difficulty': '中等',
            'servings': 4,
            'ingredients': ['五花肉 500g', '冰糖 20g', '生抽 2勺', '老抽 1勺', '料酒 2勺', '八角 2个', '桂皮 1块', '葱姜 适量'],
            'steps': [
                '五花肉切块冷水焯水,沥干',
                '锅中少油放冰糖炒出糖色',
                '下肉块翻炒上色,加葱姜八角桂皮',
                '加料酒、生抽、老抽和开水没过肉',
                '大火烧开转小火炖60分钟,大火收汁'
            ],
            'notes': '炒糖色别炒糊,小火慢炖才软糯。'
        },
        {
            'id': 'sys_003',
            'name': '紫菜蛋花汤',
            'category': '汤品',
            'tags': ['快手', '汤', '素'],
            'blogger_id': 'system',
            'blogger_name': '官方推荐',
            'image': '🥣',
            'cook_time': '10分钟',
            'difficulty': '简单',
            'servings': 2,
            'ingredients': ['紫菜 1张', '鸡蛋 1个', '虾皮 1小把', '葱花 适量', '香油 少许', '盐 适量'],
            'steps': [
                '紫菜撕碎,虾皮温水泡一下去盐',
                '水烧开,放入紫菜虾皮煮1分钟',
                '转小火,淋入打散的蛋液形成蛋花',
                '加盐调味,撒葱花淋香油'
            ],
            'notes': '蛋液要细流淋入,蛋花才漂亮。'
        }
    ]

    for r in built_in_recipes:
        if r['id'] not in data['recipes']:
            recipe = {
                **r,
                'source_type': 'system',
                'owner': 'system',
                'family_id': '',
                'favorite': False,
                'clone_count': 0,
                'created_at': datetime.now().isoformat()
            }
            data['recipes'][r['id']] = recipe

    # 更新博主食谱计数
    for b in data['bloggers'].values():
        b['recipe_count'] = len([r for r in data['recipes'].values() if r.get('blogger_id') == b['id']])

    save_db(data)
    return data

# 初始化
db = load_db()

def get_current_user(request):
    """从请求头获取当前用户"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token or token not in db['sessions']:
        return None
    return db['sessions'][token]

def generate_token():
    return uuid.uuid4().hex

def get_week_key(date_str=None):
    """获取本周的 key(以周一为起点)"""
    if date_str:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
    else:
        dt = datetime.now()
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime('%Y-%m-%d')

def escape_html(s):
    if not s: return ''
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

# ==================== 静态文件 ====================
@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(STATIC_DIR, path)

# ==================== 用户认证 ====================
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    nickname = data.get('nickname', username).strip()

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400

    if username in db['users']:
        return jsonify({'error': '用户名已存在'}), 400

    user_id = uuid.uuid4().hex
    db['users'][username] = {
        'id': user_id,
        'username': username,
        'password': password,
        'nickname': nickname,
        'avatar_color': data.get('avatar_color', '#FF6B35'),
        'created_at': datetime.now().isoformat()
    }
    if username not in db['collections']:
        db['collections'][username] = {}

    token = generate_token()
    db['sessions'][token] = username

    save_db(db)
    return jsonify({
        'token': token,
        'user': {
            'id': user_id,
            'username': username,
            'nickname': nickname,
            'avatar_color': db['users'][username]['avatar_color']
        }
    })

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if username not in db['users'] or db['users'][username]['password'] != password:
        return jsonify({'error': '用户名或密码错误'}), 401

    if username not in db['collections']:
        db['collections'][username] = {}

    token = generate_token()
    db['sessions'][token] = username

    user = db['users'][username]
    save_db(db)
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'nickname': user['nickname'],
            'avatar_color': user['avatar_color']
        }
    })

@app.route('/api/me', methods=['GET'])
def me():
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401
    user = db['users'][username]
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'nickname': user['nickname'],
        'avatar_color': user['avatar_color']
    })

# ==================== 博主管理 ====================
@app.route('/api/bloggers', methods=['GET'])
def get_bloggers():
    # 博主列表是公开内容,未登录也可浏览(学菜页第一屏)
    all_bloggers = []
    for b in db['bloggers'].values():
        all_bloggers.append({
            'id': b['id'],
            'name': b['name'],
            'avatar': b.get('avatar', '👨‍🍳'),
            'desc': b.get('desc', ''),
            'platform': b.get('platform', ''),
            'tags': b.get('tags', []),
            'recipe_count': b.get('recipe_count', 0)
        })
    return jsonify({'bloggers': all_bloggers})

# ==================== 食谱管理(发现 + 我的) ====================
@app.route('/api/recipes', methods=['GET'])
def get_recipes():
    username = get_current_user(request)
    source = request.args.get('source', 'all').strip()
    keyword = request.args.get('keyword', '').strip()
    category = request.args.get('category', '').strip()
    tag = request.args.get('tag', '').strip()
    blogger_id = request.args.get('blogger_id', '').strip()

    # source 说明:
    # all - 系统和博主食谱(发现页) [公开]
    # mine - 当前用户自己的食谱(我的食谱本) [需登录]
    # blogger - 指定博主食谱 [公开]
    # collected - 我收藏的食谱 [需登录]

    # 私人内容需要登录
    if source in ('mine', 'collected') and not username:
        return jsonify({'error': '未登录'}), 401

    recipes = []
    if source == 'mine':
        for r in db['recipes'].values():
            if r.get('owner') == username and r.get('source_type') in ('user', 'clone'):
                recipes.append(r)
    elif source == 'collected':
        collected_ids = db['collections'].get(username, {})
        for rid in collected_ids:
            if rid in db['recipes']:
                recipes.append(db['recipes'][rid])
    elif source == 'blogger' and blogger_id:
        for r in db['recipes'].values():
            if r.get('source_type') == 'system' and r.get('blogger_id') == blogger_id:
                recipes.append(r)
    else:
        # 发现页:系统内置食谱 [公开]
        for r in db['recipes'].values():
            if r.get('source_type') == 'system':
                recipes.append(r)

    # 过滤
    if keyword:
        recipes = [r for r in recipes if keyword.lower() in r['name'].lower() or
                   any(keyword.lower() in ing.lower() for ing in r.get('ingredients', []))]
    if category and category != '全部':
        recipes = [r for r in recipes if r.get('category') == category]
    if tag and tag != '全部':
        recipes = [r for r in recipes if tag in r.get('tags', [])]

    return jsonify({'recipes': recipes})

@app.route('/api/recipes/<recipe_id>', methods=['GET'])
def get_recipe_detail(recipe_id):
    username = get_current_user(request)

    if recipe_id not in db['recipes']:
        return jsonify({'error': '食谱不存在'}), 404

    recipe = db['recipes'][recipe_id]

    # 私人食谱(用户自建/克隆)需要登录,且只能是本人查看
    if recipe.get('source_type') in ('user', 'clone') and recipe.get('owner') != username:
        return jsonify({'error': '未登录或无权查看'}), 401

    # 克隆信息:当前用户是否已经复刻过(未登录则为空)
    user_clones = []
    if username:
        user_clones = [r for r in db['recipes'].values()
                       if r.get('cloned_from') == recipe_id and r.get('owner') == username]

    result = dict(recipe)
    result['is_collected'] = recipe_id in db['collections'].get(username, {}) if username else False
    result['user_clone_id'] = user_clones[0]['id'] if user_clones else None

    return jsonify(result)

@app.route('/api/recipes', methods=['POST'])
def add_recipe():
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    data = request.json
    recipe_id = uuid.uuid4().hex

    recipe = {
        'id': recipe_id,
        'name': data.get('name', '').strip(),
        'category': data.get('category', '其他'),
        'tags': data.get('tags', []),
        'ingredients': data.get('ingredients', []),
        'steps': data.get('steps', []),
        'image': data.get('image', ''),
        'cook_time': data.get('cook_time', ''),
        'difficulty': data.get('difficulty', '简单'),
        'servings': data.get('servings', 2),
        'notes': data.get('notes', ''),
        'source_type': 'user',
        'owner': username,
        'family_id': data.get('family_id', ''),
        'blogger_id': data.get('blogger_id', ''),
        'blogger_name': data.get('blogger_name', ''),
        'cloned_from': data.get('cloned_from', ''),
        'favorite': data.get('favorite', False),
        'clone_count': 0,
        'created_at': datetime.now().isoformat()
    }

    db['recipes'][recipe_id] = recipe
    save_db(db)
    return jsonify(recipe)

@app.route('/api/recipes/<recipe_id>/clone', methods=['POST'])
def clone_recipe(recipe_id):
    """复刻系统/博主食谱到自己的食谱本"""
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    if recipe_id not in db['recipes']:
        return jsonify({'error': '食谱不存在'}), 404

    original = db['recipes'][recipe_id]

    # 检查是否已经复刻过
    existing = [r for r in db['recipes'].values()
                if r.get('cloned_from') == recipe_id and r.get('owner') == username]
    if existing:
        return jsonify({'recipe': existing[0], 'already_cloned': True})

    new_id = uuid.uuid4().hex
    new_recipe = copy.deepcopy(original)
    new_recipe.update({
        'id': new_id,
        'source_type': 'clone',
        'owner': username,
        'family_id': '',
        'cloned_from': recipe_id,
        'created_at': datetime.now().isoformat(),
        'favorite': False,
        'clone_count': 0
    })

    # 原食谱克隆计数 +1
    if 'clone_count' not in original:
        original['clone_count'] = 0
    original['clone_count'] += 1

    db['recipes'][new_id] = new_recipe
    save_db(db)
    return jsonify({'recipe': new_recipe, 'already_cloned': False})

@app.route('/api/recipes/<recipe_id>/collect', methods=['POST'])
def collect_recipe(recipe_id):
    """收藏/取消收藏食谱"""
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    if recipe_id not in db['recipes']:
        return jsonify({'error': '食谱不存在'}), 404

    user_collections = db['collections'].setdefault(username, {})

    if recipe_id in user_collections:
        del user_collections[recipe_id]
        saved = False
    else:
        user_collections[recipe_id] = datetime.now().isoformat()
        saved = True

    save_db(db)
    return jsonify({'saved': saved})

@app.route('/api/recipes/<recipe_id>', methods=['PUT'])
def update_recipe(recipe_id):
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    if recipe_id not in db['recipes']:
        return jsonify({'error': '食谱不存在'}), 404

    recipe = db['recipes'][recipe_id]
    if recipe['owner'] != username:
        return jsonify({'error': '无权修改他人食谱'}), 403

    data = request.json
    for key in ['name', 'category', 'tags', 'ingredients', 'steps', 'image',
                'cook_time', 'difficulty', 'servings', 'notes', 'favorite']:
        if key in data:
            recipe[key] = data[key]

    recipe['updated_at'] = datetime.now().isoformat()
    save_db(db)
    return jsonify(recipe)

@app.route('/api/recipes/<recipe_id>', methods=['DELETE'])
def delete_recipe(recipe_id):
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    if recipe_id not in db['recipes']:
        return jsonify({'error': '食谱不存在'}), 404

    recipe = db['recipes'][recipe_id]
    if recipe['owner'] != username:
        return jsonify({'error': '无权删除他人食谱'}), 403

    del db['recipes'][recipe_id]

    # 从收藏中移除
    if username in db['collections'] and recipe_id in db['collections'][username]:
        del db['collections'][username][recipe_id]

    save_db(db)
    return jsonify({'success': True})

# ==================== 家庭管理(保留) ====================
@app.route('/api/family/create', methods=['POST'])
def create_family():
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    data = request.json
    family_name = data.get('name', '').strip()
    if not family_name:
        return jsonify({'error': '家庭名称不能为空'}), 400

    family_id = uuid.uuid4().hex
    invite_code = uuid.uuid4().hex[:6].upper()

    db['families'][family_id] = {
        'id': family_id,
        'name': family_name,
        'owner': username,
        'members': [username],
        'invite_code': invite_code,
        'created_at': datetime.now().isoformat()
    }

    save_db(db)
    return jsonify(db['families'][family_id])

@app.route('/api/family/join', methods=['POST'])
def join_family():
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    data = request.json
    invite_code = data.get('invite_code', '').strip().upper()

    family = None
    for f in db['families'].values():
        if f['invite_code'] == invite_code:
            family = f
            break

    if not family:
        return jsonify({'error': '邀请码无效'}), 404

    if username not in family['members']:
        family['members'].append(username)

    save_db(db)
    return jsonify(family)

@app.route('/api/family/my', methods=['GET'])
def my_family():
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    families = []
    for f in db['families'].values():
        if username in f['members']:
            member_info = []
            for m in f['members']:
                if m in db['users']:
                    u = db['users'][m]
                    member_info.append({
                        'username': u['username'],
                        'nickname': u['nickname'],
                        'avatar_color': u['avatar_color']
                    })
            families.append({**f, 'member_info': member_info})

    return jsonify({'families': families})

# ==================== 本周菜单(保留) ====================
@app.route('/api/menu', methods=['GET'])
def get_menu():
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    family_id = request.args.get('family_id', '')
    week_key = request.args.get('week', get_week_key())

    if family_id and family_id in db['families']:
        if username not in db['families'][family_id]['members']:
            return jsonify({'error': '无权访问'}), 403
        key = f"{family_id}_{week_key}"
    else:
        key = f"personal_{username}_{week_key}"

    menu = db['weekly_menu'].get(key, {'week': week_key, 'items': []})

    enriched_items = []
    for item in menu['items']:
        recipe = db['recipes'].get(item['recipe_id'], {})
        enriched_item = dict(item)
        enriched_item['recipe'] = recipe
        enriched_items.append(enriched_item)
    menu['items'] = enriched_items

    return jsonify(menu)

@app.route('/api/menu', methods=['POST'])
def add_to_menu():
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    data = request.json
    family_id = data.get('family_id', '')
    week_key = data.get('week', get_week_key())

    if family_id and family_id in db['families']:
        if username not in db['families'][family_id]['members']:
            return jsonify({'error': '无权操作'}), 403
        key = f"{family_id}_{week_key}"
    else:
        key = f"personal_{username}_{week_key}"

    if key not in db['weekly_menu']:
        db['weekly_menu'][key] = {'week': week_key, 'items': []}

    item = {
        'id': uuid.uuid4().hex,
        'recipe_id': data['recipe_id'],
        'date': data.get('date', ''),
        'meal_type': data.get('meal_type', '午餐'),
        'added_by': username,
        'added_at': datetime.now().isoformat()
    }

    db['weekly_menu'][key]['items'].append(item)
    save_db(db)
    return jsonify(db['weekly_menu'][key])

@app.route('/api/menu/<item_id>', methods=['DELETE'])
def remove_from_menu(item_id):
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    family_id = request.args.get('family_id', '')
    week_key = request.args.get('week', get_week_key())

    if family_id and family_id in db['families']:
        key = f"{family_id}_{week_key}"
    else:
        key = f"personal_{username}_{week_key}"

    if key in db['weekly_menu']:
        db['weekly_menu'][key]['items'] = [
            i for i in db['weekly_menu'][key]['items'] if i['id'] != item_id
        ]
        save_db(db)

    return jsonify({'success': True})

# ==================== 分类和标签 ====================
@app.route('/api/meta', methods=['GET'])
def get_meta():
    username = get_current_user(request)
    if not username:
        return jsonify({'error': '未登录'}), 401

    family_ids = [fid for fid, f in db['families'].items() if username in f['members']]

    categories = set()
    tags = set()

    # 系统食谱的分类和标签
    for r in db['recipes'].values():
        if r.get('source_type') == 'system':
            if r.get('category'):
                categories.add(r['category'])
            for t in r.get('tags', []):
                tags.add(t)

    return jsonify({
        'categories': ['全部'] + sorted(list(categories)),
        'tags': ['全部'] + sorted(list(tags)),
        'default_categories': ['肉类', '海鲜', '素菜', '面食', '汤品', '主食', '凉菜', '早餐', '午餐', '晚餐', '甜点', '其他']
    })

if __name__ == '__main__':
    os.makedirs(STATIC_DIR, exist_ok=True)
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
