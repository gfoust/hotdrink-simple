/*********************************************************************
 * These are the functions exported from a private namespace to a
 * public one.
 */

m4_export_api(model.ModelPrototype)
m4_export_api(runtime.makeGlobalModel, model)
m4_export_api(bindings.TextEdit, binders.edit)
m4_export_api(bindings.NumberEdit, binders.number)
m4_export_api(bindings.DateEdit, binders.date)
m4_export_api(bindings.Text, binders.text)

