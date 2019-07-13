module.exports = {create: sync9_create,
                  add_version: sync9_add_version,
                  read: sync9_read,
                  get_ancestors: sync9_get_ancestors,
                  extract_versions: sync9_extract_versions,
                  prune: sync9_prune,
                  prune2: sync9_prune2,
                  trav_space_dag: sync9_trav_space_dag,
                  get_space_dag: sync9_space_dag_get
}

function sync9_prune2(x, has_everyone_whos_seen_a_seen_b, has_everyone_whos_seen_a_seen_b_2) {
    // Prune the spacetree
    var seen_nodes = {} // Keep track of what nodes we've pruned
    var did_something = true
    function rec(x) {
        if (x && typeof(x) == 'object') {
            if (!x.t && x.val) {
                rec(x.val)
            } else if (x.t == 'val') {
                if (sync9_space_dag_prune2(x.S, has_everyone_whos_seen_a_seen_b, seen_nodes)) did_something = true
                rec(sync9_space_dag_get(x.S, 0))
            } else if (x.t == 'obj') {
                Object.values(x.S).forEach(v => rec(v))
            } else if (x.t == 'arr') {
                if (sync9_space_dag_prune2(x.S, has_everyone_whos_seen_a_seen_b, seen_nodes)) did_something = true
                sync9_trav_space_dag(x.S, () => true, node => {
                    node.elems.forEach(e => rec(e))
                })
            } else if (x.t == 'str') {
                if (sync9_space_dag_prune2(x.S, has_everyone_whos_seen_a_seen_b, seen_nodes)) did_something = true
            }
        }
    }
    // Pruning could open up new places to prune, so we want to keep going until we can't prune any more
    while (did_something) {
        did_something = false
        rec(x)
    }
    // Prune the time dag
    var visited = {}
    var delete_us = {}
    function f(vid) { // Given a node
        if (visited[vid]) return
        visited[vid] = true
        Object.keys(x.T[vid]).forEach(pid => { // For each parent of that node
            if (has_everyone_whos_seen_a_seen_b_2(pid, vid) && !seen_nodes[pid]) { // If the child is sufficiently acked AND [something else?]
                delete_us[pid] = true // We can delete the parent
            }
            f(pid) // Keep going
        })
    }
    Object.keys(x.leaves).forEach(f) // Explore the whole spacetree

    // Once we know what we can prune in the time dag, let's do the pruning and rearrange parental links
    var visited = {}
    var forwards = {}
    function g(vid) {
        if (visited[vid]) return
        visited[vid] = true
        if (delete_us[vid]) // If we're going to delete this node
            forwards[vid] = {} // We'll need to figure out what its new parents will be
        Object.keys(x.T[vid]).forEach(pid => {
            g(pid) // Prune from top-down
            if (delete_us[vid]) { // If we're going to prune this child
                if (delete_us[pid]) // If the parent is getting deleted too
                    Object.assign(forwards[vid], forwards[pid]) // Parent's parents become children's parents
                else // Parent is NOT getting deleted
                    forwards[vid][pid] = true // PID is a parent of deleted VID
            } else if (delete_us[pid]) { // If we're deleting the parent of this node
                delete x.T[vid][pid] // Then delete the reference from the child to the parent
                Object.assign(x.T[vid], forwards[pid]) // And the now-deleted parent's parents become parents of the child
            }
        })
    }
    Object.keys(x.leaves).forEach(g) // Explore the whole spacetree
    Object.keys(delete_us).forEach(vid => delete x.T[vid])
    return delete_us
}

function sync9_space_dag_prune2(S, has_everyone_whos_seen_a_seen_b, seen_nodes) {
    function set_nnnext(node, next) {
        while (node.next) node = node.next
        node.next = next
    }
    function process_node(node, offset, vid, prev) {
        var nexts = node.nexts
        var next = node.next
        
        var all_nexts_prunable = nexts.every(x => has_everyone_whos_seen_a_seen_b(vid, x.vid))
        if (nexts.length > 0 && all_nexts_prunable) {
            var first_prunable = 0
            var gamma = next
            if (first_prunable + 1 < nexts.length) {
                gamma = sync9_create_space_dag_node(null, typeof(node.elems) == 'string' ? '' : [])
                gamma.nexts = nexts.slice(first_prunable + 1)
                gamma.next = next
            }
            if (first_prunable == 0) {
                if (nexts[0].elems.length == 0 && !nexts[0].end_cap && nexts[0].nexts.length > 0) {
                    var beta = gamma
                    if (nexts[0].next) {
                        beta = nexts[0].next
                        set_nnnext(beta, gamma)
                    }
                    node.nexts = nexts[0].nexts
                    node.next = beta
                } else {
                    delete node.end_cap
                    node.nexts = []
                    node.next = nexts[0]
                    node.next.vid = null
                    set_nnnext(node, gamma)
                }
            } else {
                node.nexts = nexts.slice(0, first_prunable)
                node.next = nexts[first_prunable]
                node.next.vid = null
                set_nnnext(node, gamma)
            }
            return true
        }
        
        if (Object.keys(node.deleted_by).some(k => has_everyone_whos_seen_a_seen_b(vid, k)) && all_nexts_prunable) {
            node.deleted_by = {}
            node.elems = typeof(node.elems) == 'string' ? '' : []
            delete node.gash
            return true
        } else {
            Object.assign(seen_nodes, node.deleted_by)
        }
        
        if (next && !next.nexts[0] && (Object.keys(next.deleted_by).some(k => has_everyone_whos_seen_a_seen_b(vid, k)) || next.elems.length == 0)) {
            node.next = next.next
            return true
        }
        
        if (nexts.length == 0 && next &&
            !(next.elems.length == 0 && !next.end_cap && next.nexts.length > 0) &&
            Object.keys(node.deleted_by).every(x => next.deleted_by[x]) &&
            Object.keys(next.deleted_by).every(x => node.deleted_by[x])) {
                
            node.elems = node.elems.concat(next.elems)
            node.end_cap = next.end_cap
            node.nexts = next.nexts
            node.next = next.next
            return true
        }
    }
    var did_something = false
    sync9_trav_space_dag(S, () => true, (node, offset, has_nexts, prev, vid) => {
        if (!prev) seen_nodes[vid] = true
        while (process_node(node, offset, vid, prev)) {
            did_something = true
        }
    }, true)
    return did_something
}

function sync9_extract_versions(x, is_anc, is_new_anc) {
    var versions = sync9_space_dag_extract_versions(sync9_space_dag_get(x.val.S, 0).S, x, is_anc, is_new_anc)
    versions.forEach(x => {
        x.changes = x.splices.map(x => {
            return `[${x[0]}:${x[0] + x[1]}] = ${JSON.stringify(x[2])}`
        })
        delete x.splices
    })
    return versions
}

function sync9_space_dag_extract_versions(S, s9, is_anc, is_new_anc) {
    var versions = Object.keys(s9.T).filter(x => !is_anc(x) && is_new_anc(x)).map(vid => {
        var v = {
            vid,
            parents : Object.assign({}, s9.T[vid]),
            splices : []
        }
        
        function add_result(offset, del, ins) {
            if (v.splices.length > 0) {
                var prev = v.splices[v.splices.length - 1]
                if (prev[0] + prev[1] == offset) {
                    prev[1] += del
                    prev[2] = prev[2].concat(ins)
                    return
                }
            }
            v.splices.push([offset, del, ins])
        }
        
        var ancs = sync9_get_ancestors(s9, {[vid]: true})
        delete ancs[vid]
        var offset = 0
        function helper(node, vid) {
            if (vid == v.vid) {
                add_result(offset, 0, node.elems.slice(0))
            } else if (node.deleted_by[v.vid]) {
                add_result(offset, node.elems.length, node.elems.slice(0, 0))
            }
            
            if (ancs[vid] && !Object.keys(node.deleted_by).some(x => ancs[x])) {
                offset += node.elems.length
            }
                
            for (var next of node.nexts)
                helper(next, next.vid)
            if (node.next) helper(node.next, vid)
        }
        helper(S, S.vid)
        return v
    })
    
    var sorted = []
    var seen = {}
    while (versions.length > 0)
        versions = versions.filter(v => {
            if (Object.keys(v.parents).every(x => is_anc(x) || seen[x])) {
                seen[v.vid] = true
                sorted.push(v)
                return false
            } return true
        })
    return sorted
}

function sync9_create() {
    return {
        T: {root : {}},
        leaves: {root: true},
        val: sync9_create_val()
    }
}

function sync9_add_version(x, vid, parents, changes, is_anc) {
    if (x.T[vid]) return
    x.T[vid] = Object.assign({}, parents)
    Object.keys(parents).forEach(k => {
        if (x.leaves[k]) delete x.leaves[k]
    })
    x.leaves[vid] = true
    
    if (!is_anc) {
        if (parents == x.leaves) {
            is_anc = (_vid) => _vid != vid
        } else {
            var ancs = sync9_get_ancestors(x, parents)
            is_anc = _vid => ancs[_vid]
        }
    }
    
    changes.forEach(change => {
        var parse = sync9_parse_change(change)
        var cur = x.val
        each(parse.keys, (key, i) => {
            if (cur.t == 'val') cur = sync9_space_dag_get(cur.S, 0, is_anc)
            if (!cur) throw 'bad'
            if (typeof(key) == 'string' && cur.t == 'obj') {
                if (!cur.S[key]) cur.S[key] = sync9_create_val()
                cur = cur.S[key]
            } else if (typeof(key) == 'number') {
                if (i == parse.keys.length - 1) {
                    parse.range = [key, key + 1]
                    parse.val = [parse.val]
                } else if (i < parse.keys.length - 1 && cur.t == 'arr') {
                    cur = sync9_space_dag_get(cur.S, key, is_anc)
                } else throw 'bad'
            } else {
                throw 'bad'
            }
        })
        if (!parse.range) {
            if (cur.t != 'val') throw 'bad'
            sync9_space_dag_add_version(cur.S, vid, [[0, 0, [sync9_wrap(parse.val, vid)]]], is_anc)
        } else {
            if (cur.t == 'val') cur = sync9_space_dag_get(cur.S, 0, is_anc)
            if (parse.val instanceof Array && cur.t != 'arr') throw 'bad'
            if (parse.val instanceof String && cur.t != 'str') throw 'bad'
            if (parse.val instanceof Array) parse.val = parse.val.map(x => sync9_wrap(x, vid))
            sync9_space_dag_add_version(cur.S, vid, [[parse.range[0], parse.range[1] - parse.range[0], parse.val]], is_anc)
        }
    })
}

function sync9_read(x) {
    if (x && typeof(x) == 'object') {
        if (!x.t && x.val) return sync9_read(x.val)
        if (x.t == 'val') return sync9_read(sync9_space_dag_get(x.S, 0))
        if (x.t == 'obj') {
            var o = {}
            Object.entries(x.S).forEach(([k, v]) => {
                o[k] = sync9_read(v)
            })
            return o
        }
        if (x.t == 'arr') {
            var a = []
            sync9_trav_space_dag(x.S, () => true, (node) => {
                node.elems.forEach((e) => {
                    a.push(sync9_read(e))
                })
            })
            return a
        }
        if (x.t == 'str') {
            var s = []
            sync9_trav_space_dag(x.S, () => true, (node) => {
                s.push(node.elems)
            })
            return s.join('')
        }
    } return x
}

function sync9_wrap(x, vid) {
    if (typeof(x) == 'number') {
        return x
    } else if (typeof(x) == 'string') {
        var s = sync9_create_str()
        sync9_space_dag_add_version(s.S, vid, [[0, 0, x]], _vid => _vid != vid)
        return s
    } else if (typeof(x) == 'object') {
        if (x instanceof Array) {
            var a = sync9_create_arr()
            sync9_space_dag_add_version(a.S, vid, [[0, 0, x.map(x => sync9_wrap(x, vid))]], _vid => _vid != vid)
            return a
        } else {
            var o = sync9_create_obj()
            Object.entries(x).forEach(([k, v]) => {
                var val = sync9_create_val()
                sync9_space_dag_add_version(val.S, vid, [[0, 0, [sync9_wrap(v, vid)]]], _vid => _vid != vid)
                o.S[k] = val
            })
            return o
        }
    } else throw 'bad'
}

function sync9_create_val() {
    return {
        t : 'val',
        S : sync9_create_space_dag_node('root', [])
    }
}

function sync9_create_obj() {
    return {
        t : 'obj',
        S : {}
    }
}

function sync9_create_arr() {
    return {
        t : 'arr',
        S : sync9_create_space_dag_node('root', [])
    }
}

function sync9_create_str() {
    return {
        t : 'str',
        S : sync9_create_space_dag_node('root', '')
    }
}

function sync9_create_space_dag_node(vid, elems, end_cap) {
    return {
        vid : vid,
        elems : elems,
        deleted_by : {},
        end_cap : end_cap,
        nexts : [],
        next : null
    }
}

function sync9_space_dag_get(S, i, is_anc) {
    var ret = null
    var offset = 0
    sync9_trav_space_dag(S, is_anc ? is_anc : () => true, (node) => {
        if (i - offset < node.elems.length) {
            ret = node.elems[i - offset]
            return false
        }
        offset += node.elems.length
    })
    return ret
}
    
function sync9_space_dag_break_node(node, x, end_cap, new_next) {
    function subseq(x, start, stop) {
        return (x instanceof Array) ?
            x.slice(start, stop) :
            x.substring(start, stop)
    }
    
    var tail = sync9_create_space_dag_node(null, subseq(node.elems, x), node.end_cap)
    Object.assign(tail.deleted_by, node.deleted_by)
    tail.nexts = node.nexts
    tail.next = node.next
    
    node.elems = subseq(node.elems, 0, x)
    node.end_cap = end_cap
    if (end_cap) tail.gash = true
    node.nexts = new_next ? [new_next] : []
    node.next = tail
    
    return tail
}

function sync9_space_dag_add_version(S, vid, splices, is_anc) {
    
    function add_to_nexts(nexts, to) {
        var i = binarySearch(nexts, function (x) {
            if (to.vid < x.vid) return -1
            if (to.vid > x.vid) return 1
            return 0
        })
        nexts.splice(i, 0, to)
    }
    
    var si = 0
    var delete_up_to = 0
    
    var cb = (node, offset, has_nexts, prev, _vid, deleted) => {
        var s = splices[si]
        if (!s) return false
        
        if (deleted) {
            if (s[1] == 0 && s[0] == offset) {
                if (node.elems.length == 0 && !node.end_cap && has_nexts) return
                var new_node = sync9_create_space_dag_node(vid, s[2])
                if (node.elems.length == 0 && !node.end_cap)
                    add_to_nexts(node.nexts, new_node)
                else
                    sync9_space_dag_break_node(node, 0, undefined, new_node)
                si++
            }
            return            
        }
        
        if (s[1] == 0) {
            var d = s[0] - (offset + node.elems.length)
            if (d > 0) return
            if (d == 0 && !node.end_cap && has_nexts) return
            var new_node = sync9_create_space_dag_node(vid, s[2])
            if (d == 0 && !node.end_cap) {
                add_to_nexts(node.nexts, new_node)
            } else {
                sync9_space_dag_break_node(node, s[0] - offset, undefined, new_node)
            }
            si++
            return
        }
        
        if (delete_up_to <= offset) {
            var d = s[0] - (offset + node.elems.length)
            if (d >= 0) return
            delete_up_to = s[0] + s[1]
            
            if (s[2]) {
                var new_node = sync9_create_space_dag_node(vid, s[2])
                if (s[0] == offset && node.gash) {
                    if (!prev.end_cap) throw 'no end_cap?'
                    add_to_nexts(prev.nexts, new_node)
                } else {
                    sync9_space_dag_break_node(node, s[0] - offset, true, new_node)
                    return
                }
            } else {
                if (s[0] == offset) {
                } else {
                    sync9_space_dag_break_node(node, s[0] - offset)
                    return
                }
            }
        }
        
        if (delete_up_to > offset) {
            if (delete_up_to <= offset + node.elems.length) {
                if (delete_up_to < offset + node.elems.length) {
                    sync9_space_dag_break_node(node, delete_up_to - offset)
                }
                si++
            }
            node.deleted_by[vid] = true
            return
        }
    }
    
    var f = is_anc
    var exit_early = {}
    var offset = 0
    function helper(node, prev, vid) {
        var has_nexts = node.nexts.find(next => f(next.vid))
        var deleted = Object.keys(node.deleted_by).some(vid => f(vid))
        if (cb(node, offset, has_nexts, prev, vid, deleted) == false)
            throw exit_early
        if (!deleted) {
            offset += node.elems.length
        }
        for (var next of node.nexts)
            if (f(next.vid)) helper(next, null, next.vid)
        if (node.next) helper(node.next, node, vid)
    }
    try {
        helper(S, null, S.vid)
    } catch (e) {
        if (e != exit_early) throw e
    }
    
}

function sync9_trav_space_dag(S, f, cb, view_deleted, tail_cb) {
    var exit_early = {}
    var offset = 0
    function helper(node, prev, vid) {
        var has_nexts = node.nexts.find(next => f(next.vid))
        if (view_deleted ||
            !Object.keys(node.deleted_by).some(vid => f(vid))) {
            if (cb(node, offset, has_nexts, prev, vid) == false)
                throw exit_early
            offset += node.elems.length
        }
        for (var next of node.nexts)
            if (f(next.vid)) helper(next, null, next.vid)
        if (node.next) helper(node.next, node, vid)
        else if (tail_cb) tail_cb(node)
    }
    try {
        helper(S, null, S.vid)
    } catch (e) {
        if (e != exit_early) throw e
    }
}

function sync9_get_ancestors(x, vids) {
    var ancs = {}
    function mark_ancs(key) {
        if (!ancs[key]) {
            ancs[key] = true
            Object.keys(x.T[key]).forEach(k => mark_ancs(k))
        }
    }
    Object.keys(vids).forEach(k => mark_ancs(k))
    return ancs
}

function sync9_parse_change(change) {
    var ret = { keys : [] }
    
    var re = /\.?([^\.\[ =]+)|\[((\-?\d+)(:\-?\d+)?|'(\\'|[^'])*'|"(\\"|[^"])*")\]|\s*=\s*(.*)/g
    var m
    while (m = re.exec(change)) {
        if (m[1])
            ret.keys.push(m[1])
        else if (m[2] && m[4])
            ret.range = [
                JSON.parse(m[3]),
                JSON.parse(m[4].substr(1))
            ]
        else if (m[2])
            ret.keys.push(JSON.parse(m[2]))
        else if (m[7])
            ret.val = JSON.parse(m[7])
    }
    
    return ret
}

function sync9_diff_ODI(a, b) {
    var offset = 0
    var prev = null
    var ret = []
    var d = diff_main(a, b)
    for (var i = 0; i < d.length; i++) {
        if (d[i][0] == 0) {
            if (prev) ret.push(prev)
            prev = null
            offset += d[i][1].length
        } else if (d[i][0] == 1) {
            if (prev)
                prev[2] += d[i][1]
            else
                prev = [offset, 0, d[i][1]]
        } else {
            if (prev)
                prev[1] += d[i][1].length
            else
                prev = [offset, d[i][1].length, '']
            offset += d[i][1].length
        }
    }
    if (prev) ret.push(prev)
    return ret
}

function sync9_create_proxy(x, cb, path) {
    path = path || ''
    var child_path = key => path + '[' + JSON.stringify(key) + ']'
    return new Proxy(x, {
        get : (x, key) => {
            if (['copyWithin', 'reverse', 'sort', 'fill'].includes(key))
                throw 'proxy does not support function: ' + key
            if (key == 'push') return function () {
                var args = Array.from(arguments)
                cb([path + '[' + x.length + ':' + x.length + '] = ' + JSON.stringify(args)])
                return x.push.apply(x, args)
            }
            if (key == 'pop') return function () {
                cb([path + '[' + (x.length - 1) + ':' + x.length + '] = []'])
                return x.pop()
            }
            if (key == 'shift') return function () {
                cb([path + '[0:1] = []'])
                return x.shift()
            }
            if (key == 'unshift') return function () {
                var args = Array.from(arguments)
                cb([path + '[0:0] = ' + JSON.stringify(args)])
                return x.unshift.apply(x, args)
            }
            if (key == 'splice') return function () {
                var args = Array.from(arguments)
                cb([child_path(key) + '[' + args[0] + ':' + (args[0] + args[1]) + '] = ' + JSON.stringify(args.slice(2))])
                return x.splice.apply(x, args)
            }
            
            var y = x[key]
            if (y && typeof(y) == 'object') {
                return sync9_create_proxy(y, cb, child_path(key))
            } else return y
        },
        set : (x, key, val) => {
            if (typeof(val) == 'string' && typeof(x[key]) == 'string') {
                cb(sync9_diff_ODI(x[key], val).map(splice => {
                    return child_path(key) + '[' + splice[0] + ':' + (splice[0] + splice[1]) + '] = ' + JSON.stringify(splice[2])
                }))
            } else {
                if ((x instanceof Array) && key.match(/^\d+$/)) key = +key
                cb([child_path(key) + ' = ' + JSON.stringify(val)])
            }
            x[key] = val
            return true
        }
    })
}

function sync9_prune(x, has_everyone_whos_seen_a_seen_b, has_everyone_whos_seen_a_seen_b_2) {
    var seen_nodes = {}
    var did_something = true
    function rec(x) {
        if (x && typeof(x) == 'object') {
            if (!x.t && x.val) {
                rec(x.val)
            } else if (x.t == 'val') {
                if (sync9_space_dag_prune(x.S, has_everyone_whos_seen_a_seen_b, seen_nodes)) did_something = true
                rec(sync9_space_dag_get(x.S, 0))
            } else if (x.t == 'obj') {
                Object.values(x.S).forEach(v => rec(v))
            } else if (x.t == 'arr') {
                if (sync9_space_dag_prune(x.S, has_everyone_whos_seen_a_seen_b, seen_nodes)) did_something = true
                sync9_trav_space_dag(x.S, () => true, node => {
                    node.elems.forEach(e => rec(e))
                })
            } else if (x.t == 'str') {
                if (sync9_space_dag_prune(x.S, has_everyone_whos_seen_a_seen_b, seen_nodes)) did_something = true
            }
        }
    }
    while (did_something) {
        did_something = false
        rec(x)
    }

    var visited = {}    
    var delete_us = {}
    function f(vid) {
        if (visited[vid]) return
        visited[vid] = true
        Object.keys(x.T[vid]).forEach(pid => {
            if (has_everyone_whos_seen_a_seen_b_2(pid, vid) && !seen_nodes[pid]) {
                delete_us[pid] = true
            }
            f(pid)
        })
    }
    Object.keys(x.leaves).forEach(f)

    var visited = {}
    var forwards = {}
    function g(vid) {
        if (visited[vid]) return
        visited[vid] = true
        if (delete_us[vid])
            forwards[vid] = {}
        Object.keys(x.T[vid]).forEach(pid => {
            g(pid)
            if (delete_us[vid]) {
                if (delete_us[pid])
                    Object.assign(forwards[vid], forwards[pid])
                else
                    forwards[vid][pid] = true
            } else if (delete_us[pid]) {
                delete x.T[vid][pid]
                Object.assign(x.T[vid], forwards[pid])
            }
        })
    }
    Object.keys(x.leaves).forEach(g)
    Object.keys(delete_us).forEach(vid => delete x.T[vid])
    return delete_us
}

function sync9_space_dag_prune(S, has_everyone_whos_seen_a_seen_b, seen_nodes) {
    function set_nnnext(node, next) {
        while (node.next) node = node.next
        node.next = next
    }
    function process_node(node, offset, vid, prev) {
        var nexts = node.nexts
        var next = node.next

        var first_prunable = nexts.findIndex(x => has_everyone_whos_seen_a_seen_b(vid, x.vid))
        if (first_prunable > 0 && (node.elems.length > 0 || !prev)) {
            first_prunable = nexts.findIndex((x, i) => (i > first_prunable) && has_everyone_whos_seen_a_seen_b(vid, x.vid))
        }
        
        if (first_prunable >= 0) {
            var gamma = next
            if (first_prunable + 1 < nexts.length) {
                gamma = sync9_create_space_dag_node(null, typeof(node.elems) == 'string' ? '' : [])
                gamma.nexts = nexts.slice(first_prunable + 1)
                gamma.next = next
            }
            if (first_prunable == 0) {
                if (nexts[0].elems.length == 0 && !nexts[0].end_cap && nexts[0].nexts.length > 0) {
                    var beta = gamma
                    if (nexts[0].next) {
                        beta = nexts[0].next
                        set_nnnext(beta, gamma)
                    }
                    node.nexts = nexts[0].nexts
                    node.next = beta
                } else {
                    delete node.end_cap
                    node.nexts = []
                    node.next = nexts[0]
                    node.next.vid = null
                    set_nnnext(node, gamma)
                }
            } else {
                node.nexts = nexts.slice(0, first_prunable)
                node.next = nexts[first_prunable]
                node.next.vid = null
                set_nnnext(node, gamma)
            }
            return true
        }
        
        if (Object.keys(node.deleted_by).some(k => has_everyone_whos_seen_a_seen_b(vid, k))) {
            node.deleted_by = {}
            node.elems = typeof(node.elems) == 'string' ? '' : []
            delete node.gash
            return true
        } else {
            Object.assign(seen_nodes, node.deleted_by)
        }
        
        if (next && !next.nexts[0] && (Object.keys(next.deleted_by).some(k => has_everyone_whos_seen_a_seen_b(vid, k)) || next.elems.length == 0)) {
            node.next = next.next
            return true
        }
        
        if (nexts.length == 0 && next &&
            !(next.elems.length == 0 && !next.end_cap && next.nexts.length > 0) &&
            Object.keys(node.deleted_by).every(x => next.deleted_by[x]) &&
            Object.keys(next.deleted_by).every(x => node.deleted_by[x])) {
            node.elems = node.elems.concat(next.elems)
            node.end_cap = next.end_cap
            node.nexts = next.nexts
            node.next = next.next
            return true
        }
    }
    var did_something = false
    sync9_trav_space_dag(S, () => true, (node, offset, has_nexts, prev, vid) => {
        if (!prev) seen_nodes[vid] = true
        while (process_node(node, offset, vid, prev)) {
            did_something = true
        }
    }, true)
    return did_something
}

binarySearch = function (ar, compare_fn) {
    var m = 0;
    var n = ar.length - 1;
    while (m <= n) {
        var k = (n + m) >> 1;
        var cmp = compare_fn(ar[k]);
        if (cmp > 0) {
            m = k + 1;
        } else if(cmp < 0) {
            n = k - 1;
        } else {
            return k;
        }
    }
    return m;
}

each = function (o, cb) {
    if (o instanceof Array) {
        for (var i = 0; i < o.length; i++) {
            if (cb(o[i], i, o) == false)
                return false
        }
    } else {
        for (var k in o) {
            if (o.hasOwnProperty(k)) {
                if (cb(o[k], k, o) == false)
                    return false
            }
        }
    }
    return true
}