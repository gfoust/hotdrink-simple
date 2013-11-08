m4_module

/*********************************************************************
 * These are the functions exported from a private namespace to a
 * public one.
 */

m4_rexport(runtime.makeGlobalModel as makeModel,
           model.makeCommand,
           runtime.bind,
           runtime.runAsync,
           runtime.runSync)
