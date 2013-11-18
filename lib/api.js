/*********************************************************************
 * These are the functions exported from a private namespace to a
 * public one.
 */

m4_module

m4_import(runtime.ConstraintSystem,
          model.Model)
m4_export(globalSystem,
          makeModel,
          register);
m4_rexport(runtime.bind,
           runtime.forceAsync,
           runtime.forceSync)

var globalSystem= new ConstraintSystem();

function makeModel( vardefs ) {
  return new Model( vardefs );
}

function register( model ) {
  globalSystem.addModel( model );
}

