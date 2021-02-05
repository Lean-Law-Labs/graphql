import { Context, Node } from "../classes";
import { AuthOperations, BaseField, AuthRule, AuthOrders } from "../types";

interface Res {
    strs: string[];
    params: any;
}

interface Allow {
    varName: string;
    parentNode: Node;
    chainStr?: string;
}

// function createAuthAndParams({
//     varName,
//     node,
//     chainStr,
//     context,
//     functionType,
//     recurseArray,
//     operation,
//     chainStrOverRide,
//     type,
// }: {
//     node: Node;
//     context: Context;
//     varName: string;
//     chainStr?: string;
//     functionType?: boolean;
//     recurseArray?: AuthRule[];
//     operation: AuthOperations;
//     chainStrOverRide?: string;
//     type: "bind" | "allow";
// }): [string, any] {
//     const rules = (node?.auth?.rules || []).filter(
//         (r) => r.operations?.includes(operation) && r[type] && r.isAuthenticated !== false
//     );

//     if (rules.filter((x) => x[type] === "*").length && !recurseArray) {
//         return ["", {}];
//     }

//     function reducer(res: Res, ruleValue: any, index: number): Res {
//         let param = "";
//         if (chainStr && !chainStrOverRide) {
//             param = chainStr;
//         } else if (chainStrOverRide) {
//             param = `${chainStrOverRide}${index}`;
//         } else {
//             param = `${varName}_auth${index}`;
//         }

//         Object.entries(ruleValue).forEach(([key, value]) => {
//             switch (key) {
//                 case "AND":
//                 case "OR":
//                     {
//                         const inner: string[] = [];

//                         ((value as unknown) as any[]).forEach((v, i) => {
//                             const recurse = createAuthAndParams({
//                                 recurseArray: [{ [type]: v }],
//                                 varName,
//                                 node,
//                                 chainStr: `${param}_${key}${i}`,
//                                 context,
//                                 operation,
//                                 type,
//                             });

//                             inner.push(
//                                 recurse[0]
//                                     .replace("CALL apoc.util.validate(NOT(", "")
//                                     .replace(`), "Forbidden", [0])`, "")
//                             );
//                             res.params = { ...res.params, ...recurse[1] };
//                         });

//                         res.strs.push(`(${inner.join(` ${key} `)})`);
//                     }
//                     break;

//                 default: {
//                     if (typeof value === "string") {
//                         const _param = `${param}_${key}`;
//                         res.strs.push(`${varName}.${key} = $${_param}`);

//                         const jwt = context.getJWT();

//                         if (!jwt) {
//                             throw new Error("Unauthorized");
//                         }

//                         res.params[_param] = jwt[value];
//                     }

//                     const relationField = node.relationFields.find((x) => key === x.fieldName);
//                     if (relationField) {
//                         const refNode = context.neoSchema.nodes.find(
//                             (x) => x.name === relationField.typeMeta.name
//                         ) as Node;

//                         const inStr = relationField.direction === "IN" ? "<-" : "-";
//                         const outStr = relationField.direction === "OUT" ? "->" : "-";
//                         const relTypeStr = `[:${relationField.type}]`;
//                         const relationVarName = relationField.fieldName;

//                         let resultStr = [
//                             `EXISTS((${varName})${inStr}${relTypeStr}${outStr}(:${relationField.typeMeta.name}))`,
//                             `AND ${
//                                 type === "bind" ? "ALL" : "ANY"
//                             }(${relationVarName} IN [(${varName})${inStr}${relTypeStr}${outStr}(${relationVarName}:${
//                                 relationField.typeMeta.name
//                             }) | ${relationVarName}] WHERE `,
//                         ].join(" ");

//                         Object.entries(value as any).forEach(([k, v]: [string, any]) => {
//                             const recurse = createAuthAndParams({
//                                 node: refNode,
//                                 context,
//                                 chainStr: `${param}_${key}`,
//                                 varName: relationVarName,
//                                 recurseArray: [{ [type]: { [k]: v } }],
//                                 operation,
//                                 type,
//                             });

//                             resultStr += recurse[0]
//                                 .replace("CALL apoc.util.validate(NOT(", "")
//                                 .replace(`), "Forbidden", [0])`, "");

//                             resultStr += ")"; // close ALL
//                             res.params = { ...res.params, ...recurse[1] };
//                             res.strs.push(resultStr);
//                         });
//                     }
//                 }
//             }
//         });

//         return res;
//     }

//     const { strs, params } = (recurseArray || rules).reduce(
//         (res: Res, value, i) => reducer(res, value[type] as any, i),
//         {
//             strs: [],
//             params: {},
//         }
//     ) as Res;

//     const auth = strs.length ? `CALL apoc.util.validate(NOT(${strs.join(" AND ")}), "Forbidden", [0])` : "";

//     if (functionType) {
//         return [auth.replace(/CALL/g, "").replace(/apoc.util.validate/g, "apoc.util.validatePredicate"), params];
//     }

//     return [auth, params];
// }

function createRolesStr(roles: string[]) {
    const joined = roles.map((r) => `"${r}"`).join(", ");
    return `ANY(r IN [${joined}] WHERE ANY(rr IN $auth.roles WHERE r = rr))`;
}

function createAllowAndParams({
    rule,
    node,
    varName,
    context,
    chainStr,
}: {
    context: Context;
    varName: string;
    node: Node;
    rule: AuthRule;
    chainStr?: string;
}): [string, any] {
    const allow = rule.allow;
    if (allow === "*") {
        return [`true`, {}];
    }

    let param = "";
    if (chainStr) {
        param = chainStr;
    } else {
        param = `${varName}_auth_allow`;
    }

    const result = Object.entries(allow as Record<string, any>).reduce(
        (res: Res, [key, value]) => {
            switch (key) {
                case "AND":
                case "OR":
                    {
                        const inner: string[] = [];

                        ((value as unknown) as any[]).forEach((v, i) => {
                            const recurse = createAllowAndParams({
                                rule: v as AuthRule,
                                varName,
                                node,
                                chainStr: `${param}_${key}${i}`,
                                context,
                            });

                            inner.push(recurse[0]);
                            res.params = { ...res.params, ...recurse[1] };
                        });

                        res.strs.push(`(${inner.join(` ${key} `)})`);
                    }
                    break;

                default: {
                    if (typeof value === "string") {
                        const _param = `${param}_${key}`;
                        res.strs.push(`${varName}.${key} = $${_param}`);

                        const jwt = context.getJWT();

                        if (!jwt) {
                            throw new Error("Unauthorized");
                        }

                        res.params[_param] = jwt[value];
                    }

                    const relationField = node.relationFields.find((x) => key === x.fieldName);
                    if (relationField) {
                        const refNode = context.neoSchema.nodes.find(
                            (x) => x.name === relationField.typeMeta.name
                        ) as Node;

                        const inStr = relationField.direction === "IN" ? "<-" : "-";
                        const outStr = relationField.direction === "OUT" ? "->" : "-";
                        const relTypeStr = `[:${relationField.type}]`;
                        const relationVarName = relationField.fieldName;

                        let resultStr = [
                            `EXISTS((${varName})${inStr}${relTypeStr}${outStr}(:${relationField.typeMeta.name}))`,
                            `AND ANY(${relationVarName} IN [(${varName})${inStr}${relTypeStr}${outStr}(${relationVarName}:${relationField.typeMeta.name}) | ${relationVarName}] WHERE `,
                        ].join(" ");

                        Object.entries(value as any).forEach(([k, v]: [string, any]) => {
                            const recurse = createAllowAndParams({
                                node: refNode,
                                context,
                                chainStr: `${param}_${key}`,
                                varName: relationVarName,
                                rule: { allow: { [k]: v } } as AuthRule,
                            });
                            resultStr += recurse[0];
                            resultStr += ")"; // close ALL
                            res.params = { ...res.params, ...recurse[1] };
                            res.strs.push(resultStr);
                        });
                    }
                }
            }

            return res;
        },
        { params: {}, strs: [] }
    ) as Res;

    return [result.strs.join(" AND "), result.params];
}

function createAuthAndParams({
    entity,
    operation,
    skipRoles,
    skipIsAuthenticated,
    allow,
    context,
}: {
    entity: Node | BaseField;
    operation?: AuthOperations;
    skipRoles?: boolean;
    skipIsAuthenticated?: boolean;
    allow?: Allow;
    context: Context;
}): [string, any] {
    const subPredicates: string[] = [];
    let params: Record<string, unknown> = {};

    if (!entity.auth) {
        return [subPredicates.join(" AND "), params];
    }

    let authRules: AuthRule[] = [];
    if (operation) {
        authRules = entity?.auth.rules.filter((r) => r.operations?.includes(operation));
    } else {
        authRules = entity?.auth.rules;
    }

    if (!skipRoles) {
        const rules = authRules.filter((o) => Boolean(o.roles)).map((r) => createRolesStr(r.roles as string[]));

        subPredicates.push(rules.join(" OR "));
    }

    if (!skipIsAuthenticated) {
        const rules = authRules
            .filter((o) => o.isAuthenticated === true || o.isAuthenticated === false)
            .map((o) => `$auth.isAuthenticated = ${Boolean(o?.isAuthenticated)}`);

        subPredicates.push(rules.join(" OR "));
    }

    if (allow) {
        const rules: string[] = [];

        authRules
            .filter((rule) => rule.allow)
            .forEach((rule) => {
                const allowAndParams = createAllowAndParams({
                    context,
                    node: allow.parentNode,
                    varName: allow.varName,
                    rule,
                    chainStr: allow.chainStr,
                });
                if (allowAndParams[0]) {
                    rules.push(allowAndParams[0]);
                    params = { ...params, ...allowAndParams[1] };
                }
            });

        subPredicates.push(rules.join(" OR "));
    }

    return [subPredicates.filter(Boolean).join(" AND "), params];
}

export default createAuthAndParams;
