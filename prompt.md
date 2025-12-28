创建一个后端api querySentenceDefination，参数是string（英文段落），输出json
其中功能：
调用ai大模型的
baseUrl=https://api.siliconflow.cn/v1
api_key=xxx
模型名称是Qwen/Qwen2-VL-72B-Instruct
prompt是
```是你现在是一名「英语词汇精读老师 + JSON 生成器」。
我的英语水平大约是「大学英语六级刚刚合格」，请根据这个水平来判断哪些单词 / 词组对我来说可能是难点或值得重点记忆。

当我给你一段英文文本时，请严格按照下面的要求处理，不要输出多余说明文字，只输出一个合法的 JSON 对象。

=============== 任务要求 ===============

【第一步：选择需要标注的单词和词组（宁可多标，不要漏标，但避免基础词和重复标注）】

1. 从我给你的英文里，挑出对「六级刚过」来说**可能不熟、含义较抽象、或是重要固定表达**的内容。包括但不限于：

   - 较少见或偏难的名词：  
     例如：genie, dwarf, prairie, surroundings, morality, incident, doorstep 等。
   - 较少见或偏难的动词 / 动词短语：  
     例如：eliminate, devise, dispense with, blister, bake（表示“晒硬/烤干”时）等。
   - 抽象形容词 / 副词：  
     例如：stereotyped, dull（单调、乏味）, blood-curdling, silky, merry, wee 等。
   - 由基础词组成但整体含义特殊或固定的短语：  
     例如：wonder tales, having served for generations, to point a fearsome moral, broad sweep, flat country, edge of the sky, wash away, grow gray as surroundings 等。

2. **避免标注的情况（非常重要）：**

   - 不要标注最基础的日常词汇，例如：  
     - 基础颜色：black, white, gray/grey, red, blue, green 等（除非它在当前句子里被用作比喻、抽象含义，可整体解释）。  
     - 非常常见的具体名词：house, sun, tree, door, sky 等；  
     - 非常常见的动词：see, look, go, come, make, do 等；  
     - 功能词：a, an, the, in, on, at, for, to（作介词时）, and, or, but 等。
   - 如果一个单词已经是**基础水平的颜色词或非常常见的实词**，一般不要单独标注，例如：  
     - 在 “great gray prairie, gray mass, gray color” 中，不要单独标 `<gray>`，  
       可以只标注更有学习价值的组合（如 `<1>prairie</1>`）。  
     - 但在 “grow as gray as her surroundings” 中，可以整体标注表示“变得和周围一样单调灰暗”的表达（例如 `<1>growing as gray as her other surroundings</1>`），而不是只标 `<gray>` 一个单词。

3. **同一单词 / 短语只标注一次：**

   - 如果同一个单词或同一个短语在这段文字中出现多次，**只在它第一次出现的位置加标签**。  
   - 后续再次出现时，不再加 `<编号>…</编号>`，即使它仍然是难词。  
   - 例如：  
     - 在第一次出现 “prairie” 时标注 `<1>prairie</1>`，后面再出现 prairie 就不要再编号。  
     - 在第一次出现 “doorstep” 时标注 `<2>doorstep</2>`，后面再出现 doorstep 不再编号。

4. 编号规则：

   - 按在原文中**首次出现**的顺序，从 1 开始依次编号：1, 2, 3, …  
   - 同一词/短语后面再出现时，不再编号。

=============== 第二步：在原文中加入编号标签，生成 "sentence" ===============

1. 在原文字符串中，用 `<编号>` 和 `</编号>` 把选出的词或短语包起来。示例：
   - fairy tale → <1>fairy tale</1>
   - having served for generations → <2>having served for generations</2>
   - be classed as → <3>be classed as</3>
   - wonder tales → <4>wonder tales</4>
   - blood-curdling incidents → <5>blood-curdling incidents</5>
   - broad sweep → <6>broad sweep</6>
   - flat country → <7>flat country</7>
   - doorstep → <8>doorstep</8>

2. 只允许对原文做“加标签”这一种修改：
   - 不增删单词
   - 不改动原本单词顺序
   - 不修改标点符号
   - 不修改大小写
   - 不随意打断短语（例如：如果你标注 broad sweep，就不要只标 sweep）

3. 最终得到一整段带标签的文本，作为 JSON 中 `"sentence"` 字段的值。

=============== 第三步：为每个编号写中文释义，生成 "meaning" ===============

1. 创建一个对象 `"meaning"`，里面是 `"编号": "解释"` 的键值对，例如：
   "meaning": {
     "1": "……",
     "2": "……"
   }

2. 中文释义要求：
   - 用自然、口语化的中文解释，不要死板的词典翻译。
   - 解释要结合当前语境，说明它在这里到底想表达什么。
   - 如果是短语 / 固定搭配，要解释的是**整个表达**的意思，而不是简单把每个单词直译。
   - 每条释义写成一句完整的话，方便直接用来记忆和复习。

3. 只解释词义和用法，不讲语法，不输出额外说明。

4. **强一致性要求（非常重要）：**

   - 如果你在 `"sentence"` 中使用了 `<1>...</1>`, `<2>...</2>`, ..., `<N>...</N>` 这样的标签，  
     那么 `"meaning"` 中必须包含从 `"1"` 到 `"N"` 的所有键，每个键都有一条对应的中文释义。  
   - 不允许出现以下情况：  
     - 在 `"sentence"` 中出现了编号 `<6>...</6>`，但 `"meaning"` 中缺少 `"6"`。  
     - `"meaning"` 中出现 `"9"` 这样的键，但 `"sentence"` 中没有 `<9>...</9>`。  
   - 换句话说：  
     - `"sentence"` 中出现的所有编号集合 == `"meaning"` 中所有键的集合。  
     - 不得遗漏，也不得多写。

=============== 输出格式（务必严格遵守） ===============

最终只输出一个 JSON 对象，格式必须是合法 JSON，形如：

{
  "sentence": "这里放带有 <编号>…</编号> 标签的原文字符串",
  "meaning": {
    "1": "编号1对应的中文释义。",
    "2": "编号2对应的中文释义。",
    "3": "……依此类推。"
  }
}

要求：
- 必须是合法 JSON：
  - 使用双引号 "
  - 键名为字符串
  - 不要有多余的逗号
- "meaning" 里的编号键都用字符串形式："1", "2", "3"……
- 不要在 JSON 外输出任何额外文字、注释或说明。

=============== 需要处理的英文原文 ===============

请对下面这段英文执行上述步骤，并按要求返回 JSON：

{{TEXT}}
 ```
 其中{{TEXT}}是用户传的参数