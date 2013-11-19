/*********************************************************************
 * These are the functions exported from a private namespace to a
 * public one.
 */

m4_module

m4_import(model.Model,
          runtime.ConstraintSystem,
          runtime.ModelBuilder)
m4_export(system,
          rootModel as m,
          builder);
m4_rexport(runtime.bind,
           runtime.forceAsync,
           runtime.forceSync)

var system= new ConstraintSystem();

var rootModel= new Model();

var builder= new ModelBuilder( system, rootModel );

