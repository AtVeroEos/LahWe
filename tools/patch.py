"""Tiny asserted find/replace helper used while reworking the source.
Each edit must match exactly `count` times, so a silent no-op is impossible."""
import io, re, sys

class Patch:
    def __init__(self, path):
        self.path = path
        self.t = io.open(path, encoding='utf8').read()
    def rep(self, old, new, count=1):
        n = self.t.count(old)
        if n != count:
            raise SystemExit('%s: expected %d match(es), found %d for: %r' % (self.path, count, n, old[:90]))
        self.t = self.t.replace(old, new)
        return self
    def rep_all(self, old, new, min_count=1):
        n = self.t.count(old)
        if n < min_count:
            raise SystemExit('%s: expected >=%d match(es), found %d for: %r' % (self.path, min_count, n, old[:90]))
        self.t = self.t.replace(old, new)
        return self
    def sub(self, pattern, repl, count=None, flags=0):
        self.t, n = re.subn(pattern, repl, self.t, flags=flags)
        if (count is not None and n != count) or n == 0:
            raise SystemExit('%s: regex matched %d time(s) (wanted %s): %r' % (self.path, n, count, pattern[:90]))
        return self
    def save(self):
        io.open(self.path, 'w', encoding='utf8').write(self.t)

def replace_fn(p, name, new_text):
    """Replace a top-level `function name(...) {...}` (up to the next top-level declaration)."""
    m = re.search(r'^(?:async )?function ' + re.escape(name) + r'\(', p.t, flags=re.M)
    if not m:
        raise SystemExit('%s: function %s not found' % (p.path, name))
    nxt = re.search(r'^(?:(?:async )?function |const |let |// )', p.t[m.end():], flags=re.M)
    end = m.end() + nxt.start() if nxt else len(p.t)
    p.t = p.t[:m.start()] + new_text.rstrip('\n') + '\n' + p.t[end:]
    return p
Patch.fn = replace_fn

def jsq_ids(p, names, min_total=1):
    """onclick="fn('${id}')"  ->  onclick="fn(${jsq(id)})" for ids that can come from stored/imported data."""
    total = 0
    for n in names:
        old = "'${%s}'" % n
        total += p.t.count(old)
        p.t = p.t.replace(old, "${jsq(%s)}" % n)
    if total < min_total:
        raise SystemExit('%s: jsq_ids matched %d' % (p.path, total))
    return p
Patch.jsq_ids = jsq_ids
