m4_divert(`-1') # Prevent m4 from including this file in the output

# Note that this file defines the macros using the default m4 quoting `like so'
# However, within the macros themselves we quote <{like so}>.
# We do this because at the end of the file we'll change the quotes to <{ and }>
# These character sequences are much less likely to occur in JavaScript code

m4_define(`m4_convert_to_namespace',`m4_translit(m4_regexp($1,<{lib\(/.*\)?/[^/]*}>,<{hd/_\1}>),<{/}>,<{.}>)')

m4_define(`m4_module',`(function () {m4_divert(<{4}>)
}).apply( m4_convert_to_namespace( m4___file__ ) );m4_divert(<{0}>)')

m4_define(`m4_import',`var m4_regexp($1,<{\([^.]*\)$}>,<{\1}>)= hd._.$1;m4_ifelse(<{$#}>,<{1}>,<{}>,<{
$0(m4_shift($*))}>)')

m4_define(`m4_export',`m4_divert(<{3}>)
this.$1= $1;m4_divert(<{0}>)m4_ifelse(<{$#}>,<{1}>,<{}>,<{$0(m4_shift($*))}>)')

m4_define(`m4_export_api',`m4_divert(<{2}>)
hd.m4_ifelse($2,<{}>,m4_regexp($1,<{\([^.]*\)$}>,<{\1}>),$2)= hd._.$1;m4_divert(<{0}>)')

m4_define(`m4_method', `var __$1__$2= m4_divert(<{1}>)
Object.defineProperty( $1.prototype, "$2", {value: __$1__$2} );m4_divert(<{0}>)')

m4_define(`m4_debug_define', `m4_define(`$1',`m4_ifdef(<{DEBUG}>,<{$2}>,)')')
m4_define(`m4_ndebug_define',`m4_define(`$1',`m4_ifdef(<{DEBUG}>,,<{$2}>)')')

m4_debug_define(`LOG',`m4_ifdef(<{LOG_}>m4_regexp(<{$1}>,<{\([a-zA-Z]+\)}>,<{\1}>),<{window.console.log("m4___file__:m4___line__: " + m4_shift($*));}>)')

m4_ndebug_define(`DEBUG_BEGIN',`m4_divert(<{-1}>)')
m4_ndebug_define(`DEBUG_END',`m4_divert(<{0}>)')

m4_debug_define(`INSPECT',`window.console.dir($*);')

m4_debug_define( `WARNING',`window.console.warning("m4___file__:m4___line__: " + $*);')

m4_debug_define( `WARNINGIF',
`if ($1) {
  WARNING(m4_ifelse(<{$#}>,<{1}>,<{"warning"}>,<{m4_shift($*)}>));
}')

m4_debug_define(`ERROR',`window.console.error("m4___file__:m4___line__: " + $*);')

m4_debug_define(`ASSERT',
`if (!($1)) {
  ERROR(m4_ifelse(<{$#}>,<{1}>,<{"assertion failed"}>,<{m4_shift($@)}>));
}')

m4_changequote(<{,}>)

m4_divert(<{0}>)m4_dnl
