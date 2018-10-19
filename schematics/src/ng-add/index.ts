/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { addImportToModule } from '@schematics/angular/utility/ast-utils';
import { chain, noop, Rule, SchematicContext, SchematicsException, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@schematics/angular/utility/config';
import { Schema } from './schema';
import { WorkspaceProject, WorkspaceSchema } from '@angular-devkit/core/src/workspace';

import {
  addPackageToPackageJson,
  addStyleToTarget,
  getProjectFromWorkspace,
  installPackageJsonDependencies
} from '../utils';
import { InsertChange, Change } from '@schematics/angular/utility/change';
import * as ts from 'typescript';
import { getAppModulePath } from '@schematics/angular/utility/ng-ast-utils';
import { getProjectMainFile } from '../utils/project-main-file';
import { hasNgModuleImport } from '../utils/ng-module-imports';


const bootstrapStylePath =  `./node_modules/bootstrap/dist/css/bootstrap.css`;
const datePickerStylePath =  `./node_modules/ngx-bootstrap/datepicker/bs-datepicker.css`;

/* tslint:disable-next-line: no-default-export */
export default function (options: Schema): Rule {
  return chain([
    addStyles(options),
    addPackageJsonDependencies(),
    installPackageJsonDependencies(),
    options.component ? addComponentModule(options) : noop()
  ]);
}

function addComponentModule(options: Schema) {

  const modules: { [key: string]: string } = {
    alert: 'AlertModule',
    buttons: 'ButtonsModule',
    carousel: 'CarouselModule',
    collapse: 'CollapseModule',
    datepicker: 'BsDatepickerModule',
    dropdown: 'BsDropdownModule',
    modal: 'ModalModule',
    pagination: 'PaginationModule',
    popover: 'PopoverModule',
    progressbar: 'ProgressbarModule',
    rating: 'RatingModule',
    sortable: 'SortableModule',
    tabs: 'TabsModule',
    timepicker: 'TimepickerModule',
    tooltip: 'TooltipModule',
    typeahead: 'TypeaheadModule'
  };


  return (host: Tree) => {
    const workspace = getWorkspace(host);
    const project = getProjectFromWorkspace(workspace, options.project);
    const appModulePath = getAppModulePath(host, getProjectMainFile(project));

    if (options.component) {
      if (hasNgModuleImport(host, appModulePath, 'NoopComponentModule')) {
        /* tslint:disable-next-line: no-console */
        return console.warn(`Could not set up ${options.component}` +
          `because NoopComponentModule is already imported. Please manually ` +
          `set up browser animations.`);
      }

      addModuleImportToRootModule(host, modules[options.component], `ngx-bootstrap/${options.component}`, project);
    }

    return host;
  };
}

export function addModuleImportToRootModule(host: Tree, moduleName: string, src: string, project: WorkspaceProject) {
  const modulePath = getAppModulePath(host, getProjectMainFile(project));
  addModuleImportToModule(host, modulePath, moduleName, src);
}

export function addModuleImportToModule(host: Tree, modulePath: string, moduleName: string, src: string) {

  const moduleSource = getSourceFile(host, modulePath);

  if (!moduleSource) {
    throw new SchematicsException(`Module not found: ${modulePath}`);
  }

  const changes: Change[] = addImportToModule(moduleSource, modulePath, moduleName, src);
  const recorder = host.beginUpdate(modulePath);

  changes.forEach((change: Change) => {
    if (change instanceof InsertChange) {
      recorder.insertLeft(change.pos, change.toAdd);
    }
  });

  host.commitUpdate(recorder);
}

export function getSourceFile(host: Tree, path: string) {
  const buffer = host.read(path);
  if (!buffer) {
    throw new SchematicsException(`Could not find file for path: ${path}`);
  }
  const content = buffer.toString();

  return ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
}

function addPackageJsonDependencies(): Rule {
  return (host: Tree, context: SchematicContext) => {
    const dependencies: { name: string; version: string }[] = [
      { name: 'bootstrap', version: '4.1.1' },
      { name: 'ngx-bootstrap', version: '3.0.1' }
    ];

    dependencies.forEach(dependency => {
      addPackageToPackageJson(host, dependency.name, `^${dependency.version}`);
      context.logger.log('info', `✅️ Added "${dependency.name}`);
    });

    return host;
  };
}

export function addStyles(options: Schema): (host: Tree) => Tree {
  return function (host: Tree): Tree {
    const workspace = getWorkspace(host);
    const project = getProjectFromWorkspace(workspace, options.project);

    insertStyle(project, host, workspace);

    return host;
  };
}

function insertStyle(project: WorkspaceProject, host: Tree, workspace: WorkspaceSchema) {
  addStyleToTarget(project, 'build', host, datePickerStylePath, workspace);
  addStyleToTarget(project, 'test', host, datePickerStylePath, workspace);
  addStyleToTarget(project, 'build', host, bootstrapStylePath, workspace);
  addStyleToTarget(project, 'test', host, bootstrapStylePath, workspace);
}
