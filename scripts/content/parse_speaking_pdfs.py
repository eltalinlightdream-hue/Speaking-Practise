import json, re, sys, os

RAW = sys.argv[1]
OUT = sys.argv[2]

BOILER = [
    "Your partner asks you about yourself", "EXAMPLE", "You will have to talk about",
    "the topic for one to two", "minutes. You have one", "minute to think about what",
    "you are going to say.", "You can make some notes to", "help you if you wish.",
    "T.me/", "Discussion topics:", "Example questions:",
]

# Exact-text fixes: (set, original, corrected)
FIXES = [
    (2, "Have you ever lived in the coutryside?", "Have you ever lived in the countryside?"),
    (2, "How has your town changed o the last 20 years?", "How has your town changed over the last 20 years?"),
    (8, "Describe a situation When you helped someone", "Describe a situation when you helped someone"),
    (14, "Describe a something you bought from a street market", "Describe something you bought from a street market"),
    (15, "Describe an occasion when you had to do something in hurry", "Describe an occasion when you had to do something in a hurry"),
    (15, "Why you had to it quickly", "Why you had to do it quickly"),
    (18, "How can robots can affect people's lives?", "How can robots affect people's lives?"),
    (18, "Describe a travel that you were looking forward to but was delayed", "Describe a trip that you were looking forward to but was delayed"),
    (19, "What the person was complained about", "What the person complained about"),
    (23, "Do people in your like to spend their leisure time out in your country?", "Do people in your country like to spend their leisure time out?"),
    (25, "Is music important subject at school in your country?", "Is music an important subject at school in your country?"),
    (26, "Why some paintings have higher value than others?", "Why do some paintings have a higher value than others?"),
    (30, "Describe a someone who likes cooking for others", "Describe someone who likes cooking for others"),
    (30, "and explain why she likes cooking", "and explain why they like cooking"),
    (30, "More and more people are unwilling to cook. (Why is this happening?)", "Why are more and more people unwilling to cook?"),
    (31, "Describe a science subject that you interested in", "Describe a science subject that you are interested in"),
    (32, "What the rule it is", "What the rule is"),
    (33, "Are there any difference in the relationship between you and your friends and between you and other people?",
         "Is there any difference between your relationship with your friends and with other people?"),
    (34, "What it the change was and when it happened", "What the change was and when it happened"),
    (35, "Are tea and coffee popular in yoour country?", "Are tea and coffee popular in your country?"),
    (39, "When was the first time when you used map?", "When was the first time you used a map?"),
    (39, "How often do you use map?", "How often do you use a map?"),
    (39, "Some people find it easier to accept advice than other people who do. Why do you think there is this difference?",
         "Some people find it easier to accept advice than others. Why do you think there is this difference?"),
]
INCOMPLETE = {20, 21, 22, 23, 24, 25}
P3_TITLE_OVERRIDE = {7: "Being busy"}


def clean(line):
    line = line.replace("", "").replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", line).strip()


def is_boiler(line):
    return any(line.startswith(b) for b in BOILER)


def join_wrapped(lines):
    """Join lines that are continuations (previous line doesn't end a sentence)."""
    out = []
    for l in lines:
        if out and not re.search(r"[?.!)]$", out[-1]) and l[:1].islower() and not l.lower().startswith("and explain"):
            out[-1] = out[-1] + " " + l
        else:
            out.append(l)
    return out


def parse(n, text):
    lines = [clean(l) for l in text.splitlines()]
    lines = [l for l in lines if l]
    i1 = lines.index("PART 1")
    i2 = next(i for i, l in enumerate(lines) if re.fullmatch(r"PART\s*2", l))
    i3 = next(i for i, l in enumerate(lines) if re.fullmatch(r"PART\s*3", l))
    raw = text
    p1 = [l for l in lines[i1 + 1:i2] if not is_boiler(l)]
    p2 = [l for l in lines[i2 + 1:i3] if not is_boiler(l)]
    # Layout quirk (e.g. set 4): Part 1 questions extracted after the PART 2 heading.
    di_ = next((i for i, l in enumerate(p2) if l.startswith("Describe")), 0)
    p1 += [l for l in p2[:di_] if l.endswith("?")]
    p2 = p2[di_:]
    p3_block = lines[i3 + 1:]
    # Part 3 title: line after "Discussion topics:" unless it's "Example questions:"
    di = next(i for i, l in enumerate(p3_block) if l.startswith("Discussion topics"))
    p3_title = p3_block[di + 1] if not p3_block[di + 1].startswith("Example questions") else None
    ei = next(i for i, l in enumerate(p3_block) if l.startswith("Example questions"))
    p3_q = [l for l in p3_block[ei + 1:] if not is_boiler(l) and not l.startswith("SPEAKING")]
    p3_q = join_wrapped(p3_q)

    p1_title, p1_q = p1[0], join_wrapped(p1[1:])
    # dedupe within topic, keep order
    seen = set(); p1_q = [q for q in p1_q if not (q.lower() in seen or seen.add(q.lower()))]

    cue = None
    if n not in INCOMPLETE:
        p2 = join_wrapped(p2)
        si = next(i for i, l in enumerate(p2) if l.startswith("You should say"))
        title = " ".join(p2[:si])
        rest = p2[si + 1:]
        xi = next(i for i, l in enumerate(rest) if l.lower().startswith("and explain"))
        bullets = rest[:xi]
        explain = " ".join(rest[xi:])
        cue = {"title": title, "bullets": bullets, "explain": explain}

    return {
        "set_number": n,
        "name": f"SPEAKING-{n}",
        "complete": n not in INCOMPLETE,
        "part1": {"title": p1_title, "questions": p1_q},
        "part2": cue,
        "part3": {"title": P3_TITLE_OVERRIDE.get(n, p3_title), "questions": p3_q},
    }


def apply_fixes(s, applied):
    def fix(text):
        for (n, a, b) in FIXES:
            if n == s["set_number"] and text == a:
                applied.append({"set": n, "from": a, "to": b})
                return b
        return text
    s["part1"]["questions"] = [fix(q) for q in s["part1"]["questions"]]
    s["part3"]["questions"] = [fix(q) for q in s["part3"]["questions"]]
    if s["part2"]:
        s["part2"]["title"] = fix(s["part2"]["title"])
        s["part2"]["bullets"] = [fix(b) for b in s["part2"]["bullets"]]
        s["part2"]["explain"] = fix(s["part2"]["explain"])


sets, applied = [], []
for n in range(1, 41):
    with open(os.path.join(RAW, f"{n}.txt"), encoding="utf-8") as f:
        s = parse(n, f.read())
    apply_fixes(s, applied)
    sets.append(s)

missing = [f for f in FIXES if not any(a["set"] == f[0] and a["from"] == f[1] for a in applied)]
doc = {
    "format": "speaking-easy-content/v1",
    "exam": "ielts",
    "source_note": "Imported from SPEAKING-1..40 PDFs. Sets 20-25 have no Part 2 cue card and are excluded from mocks.",
    "mock_sets": sets,
    "fixes_applied": applied,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)

print("sets:", len(sets), "complete:", sum(s["complete"] for s in sets))
print("fixes applied:", len(applied), "fixes NOT matched:", len(missing))
for m in missing:
    print("  MISSING", m)
p1 = {s["part1"]["title"].lower() for s in sets}
print("unique part1 topics:", len(p1))
print("p1 questions total (unique):", len({q.lower() for s in sets for q in s["part1"]["questions"]}))
print("p3 questions total:", sum(len(s["part3"]["questions"]) for s in sets))
for s in sets:
    c = s["part2"]
    print(s["set_number"], "|", s["part1"]["title"], len(s["part1"]["questions"]), "|",
          (c["title"] + f" [{len(c['bullets'])}b]") if c else "-- INCOMPLETE --", "|",
          s["part3"]["title"], len(s["part3"]["questions"]))
