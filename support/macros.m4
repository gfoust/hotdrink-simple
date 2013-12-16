m4_divert(`-1') # Prevent m4 from including this file in the output

# Note that this file defines the macros using the default m4 quoting `like so'
# However, within the macros themselves we quote <{like so}>.
# We do this because at the end of the file we'll change the quotes to <{ and }>
# These character sequences are much less likely to occur in JavaScript code

m4_define(`m4_convert_to_namespace',`m4_translit(m4_regexp($1,<{lib\(/.*\)?/[^/]*}>,<{hd\1}>),<{/}>,<{.}>)')

m4_define(`m4_module',`(function () {m4_divert(<{4}>)
}).apply( m4_convert_to_namespace( m4___file__ ) );m4_divert(<{0}>)')

m4_define(`m4_foreach',`
m4_ifelse($2,<{}>,<{}>,<{$1($2)$0(<{$1}>,m4_shift(m4_shift($*)))}>)')

m4_define(`m4_import1s',`m4_regexp($1,<{\([^.]*\)$}>,<{var \1= hd.$1;}>)')

m4_define(`m4_import1r',`m4_regexp($1,<{\([^ ]+\) +as +\([^ ]+\)}>,<{var \2= hd.\1}>)')

m4_define(`m4_import1',`m4_ifelse(m4_regexp($1,<{ as }>),<{-1}>,<{m4_import1s($1)}>,<{m4_import1r($1)}>)')

m4_define(`m4_import',`m4_foreach(<{m4_import1}>,$*)')

m4_define(`m4_export1s',`m4_regexp($1,<{\([^.]*\)$}>,<{this.\1= $1}>);')

m4_define(`m4_export1r',`m4_regexp($1,<{\([^ ]+\) +as +\([^ ]+\)}>,<{this.\2= \1;}>)')

m4_define(`m4_export1',`m4_ifelse(m4_regexp($1,<{ as }>),<{-1}>,<{m4_export1s($1)}>,<{m4_export1r($1)}>)')

m4_define(`m4_export',`m4_divert(<{3}>)
m4_foreach(<{m4_export1}>,$*)m4_divert(<{0}>)')

m4_define(`m4_rexport1s', `m4_regexp($1,<{\([^.]*\)$}>,<{this.\1= hd.$1;}>)')

m4_define(`m4_rexport1r', `m4_regexp($1,<{\([^ ]+\) +as +\([^ ]+\)}>,<{this.\2= hd.\1;}>)')

m4_define(`m4_rexport1', `m4_ifelse(m4_regexp($1,<{ as }>),<{-1}>,<{m4_rexport1s($1)}>,<{m4_rexport1r($1)}>)')

m4_define(`m4_rexport', `m4_divert(<{3}>)
m4_foreach(<{m4_rexport1}>,$*)m4_divert(<{0}>)')

m4_define(`m4_subtype', `$1.prototype= new $2();
$1.prototype.constructor= $1;')

m4_define(`m4_member_ref', `__$1__$2')

m4_define(`m4_member', `var m4_member_ref($1, $2)= m4_divert(<{1}>)
Object.defineProperty( $1.prototype, "$2", {value: m4_member_ref($1, $2), writable: true} );m4_divert(<{0}>)')

m4_define(`m4_debug_define', `m4_define(`$1',`m4_ifdef(<{DEBUG}>,<{$2}>,)')')
m4_define(`m4_ndebug_define',`m4_define(`$1',`m4_ifdef(<{DEBUG}>,,<{$2}>)')')

m4_debug_define(`LOG',`m4_ifdef(<{LOG_}>m4_regexp(<{$1}>,<{\([a-zA-Z]+\)}>,<{\1}>),<{window.console.log("m4___file__:m4___line__: " + (m4_shift($*)));}>)')

m4_ndebug_define(`DEBUG_BEGIN',`m4_divert(<{-1}>)')
m4_ndebug_define(`DEBUG_END',`m4_divert(<{0}>)')

m4_debug_define(`INSPECT',`window.console.dir($*);')

m4_debug_define( `WARNING',`window.console.warning("m4___file__:m4___line__: " + ($*));')

m4_debug_define( `WARNINGIF',
`if ($1) {
  WARNING(m4_ifelse(<{$#}>,<{1}>,<{"warning"}>,<{m4_shift($*)}>));
}')

m4_debug_define(`ERROR',`window.console.error("m4___file__:m4___line__: " + ($*));')

m4_debug_define(`ASSERT',
`if (!($1)) {
  ERROR(m4_ifelse(<{$#}>,<{1}>,<{"assertion failed"}>,<{m4_shift($@)}>));
}')

m4_changequote(<{,}>)

m4_divert(<{0}>)m4_dnl
