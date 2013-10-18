/*********************************************************************
 * Objects of the model interact with the runtime--reporting when
 * things change or are accessed.
 *
 * I wanted to be able to decouple an object from the real runtime.
 * But I didn't want to continually write
 *   if (this.runtime) ...
 * especially since most of the time the runtime would be there.  So I
 * made this mock runtime which has the interface of the real runtime
 * but doesn't do anything.  By default the model objects will use this
 * runtime, but can easily be switched to the real runtime.
 */
m4_module
m4_import(utility.noop)
m4_export(MockRuntime)

var MockRuntime = {
  addVariable: noop,
  addConstraint: noop,
  addMethod: noop,
  varChanged: noop,
  varAccessed: noop,
  varTouched: noop
};