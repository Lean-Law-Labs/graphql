/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Neo4jGraphQLAuthJWTPlugin } from "@neo4j/graphql-plugin-auth";
import { gql } from "apollo-server";
import type { DocumentNode } from "graphql";
import { Neo4jGraphQL } from "../../../../../src";
import { createJwtRequest } from "../../../../utils/create-jwt-request";
import { formatCypher, translateQuery, formatParams } from "../../../utils/tck-test-utils";

describe("Cypher -> Connections -> Filtering -> Node -> Arrays", () => {
    const secret = "secret";
    let typeDefs: DocumentNode;
    let neoSchema: Neo4jGraphQL;

    beforeAll(() => {
        typeDefs = gql`
            type Movie {
                title: String!
                actors: [Actor!]! @relationship(type: "ACTED_IN", properties: "ActedIn", direction: IN)
            }

            type Actor {
                name: String!
                favouriteColours: [String!]
                movies: [Movie!]! @relationship(type: "ACTED_IN", properties: "ActedIn", direction: OUT)
            }

            interface ActedIn {
                screenTime: Int!
            }
        `;

        neoSchema = new Neo4jGraphQL({
            typeDefs,
            config: { enableRegex: true },
            plugins: {
                auth: new Neo4jGraphQLAuthJWTPlugin({
                    secret,
                }),
            },
        });
    });

    test("IN", async () => {
        const query = gql`
            query {
                movies {
                    title
                    actorsConnection(where: { node: { name_IN: ["Tom Hanks", "Robin Wright"] } }) {
                        edges {
                            screenTime
                            node {
                                name
                            }
                        }
                    }
                }
            }
        `;

        const req = createJwtRequest("secret", {});
        const result = await translateQuery(neoSchema, query, {
            req,
        });

        expect(formatCypher(result.cypher)).toMatchInlineSnapshot(`
            "MATCH (this:\`Movie\`)
            CALL {
                WITH this
                MATCH (this)<-[thisthis0:ACTED_IN]-(thisthis1:\`Actor\`)
                WHERE thisthis1.name IN $thisparam0
                WITH collect({ screenTime: thisthis0.screenTime, node: { name: thisthis1.name } }) AS edges
                UNWIND edges AS edge
                WITH collect(edge) AS edges, size(collect(edge)) AS totalCount
                RETURN { edges: edges, totalCount: totalCount } AS actorsConnection
            }
            RETURN this { .title, actorsConnection } as this"
        `);

        expect(formatParams(result.params)).toMatchInlineSnapshot(`
            "{
                \\"thisparam0\\": [
                    \\"Tom Hanks\\",
                    \\"Robin Wright\\"
                ]
            }"
        `);
    });

    test("NOT_IN", async () => {
        const query = gql`
            query {
                movies {
                    title
                    actorsConnection(where: { node: { name_NOT_IN: ["Tom Hanks", "Robin Wright"] } }) {
                        edges {
                            screenTime
                            node {
                                name
                            }
                        }
                    }
                }
            }
        `;

        const req = createJwtRequest("secret", {});
        const result = await translateQuery(neoSchema, query, {
            req,
        });

        expect(formatCypher(result.cypher)).toMatchInlineSnapshot(`
            "MATCH (this:\`Movie\`)
            CALL {
                WITH this
                MATCH (this)<-[thisthis0:ACTED_IN]-(thisthis1:\`Actor\`)
                WHERE NOT (thisthis1.name IN $thisparam0)
                WITH collect({ screenTime: thisthis0.screenTime, node: { name: thisthis1.name } }) AS edges
                UNWIND edges AS edge
                WITH collect(edge) AS edges, size(collect(edge)) AS totalCount
                RETURN { edges: edges, totalCount: totalCount } AS actorsConnection
            }
            RETURN this { .title, actorsConnection } as this"
        `);

        expect(formatParams(result.params)).toMatchInlineSnapshot(`
            "{
                \\"thisparam0\\": [
                    \\"Tom Hanks\\",
                    \\"Robin Wright\\"
                ]
            }"
        `);
    });

    test("INCLUDES", async () => {
        const query = gql`
            query {
                movies {
                    title
                    actorsConnection(where: { node: { favouriteColours_INCLUDES: "Blue" } }) {
                        edges {
                            screenTime
                            node {
                                name
                                favouriteColours
                            }
                        }
                    }
                }
            }
        `;

        const req = createJwtRequest("secret", {});
        const result = await translateQuery(neoSchema, query, {
            req,
        });

        expect(formatCypher(result.cypher)).toMatchInlineSnapshot(`
            "MATCH (this:\`Movie\`)
            CALL {
                WITH this
                MATCH (this)<-[thisthis0:ACTED_IN]-(thisthis1:\`Actor\`)
                WHERE $thisparam0 IN thisthis1.favouriteColours
                WITH collect({ screenTime: thisthis0.screenTime, node: { name: thisthis1.name, favouriteColours: thisthis1.favouriteColours } }) AS edges
                UNWIND edges AS edge
                WITH collect(edge) AS edges, size(collect(edge)) AS totalCount
                RETURN { edges: edges, totalCount: totalCount } AS actorsConnection
            }
            RETURN this { .title, actorsConnection } as this"
        `);

        expect(formatParams(result.params)).toMatchInlineSnapshot(`
            "{
                \\"thisparam0\\": \\"Blue\\"
            }"
        `);
    });

    test("NOT_INCLUDES", async () => {
        const query = gql`
            query {
                movies {
                    title
                    actorsConnection(where: { node: { favouriteColours_NOT_INCLUDES: "Blue" } }) {
                        edges {
                            screenTime
                            node {
                                name
                                favouriteColours
                            }
                        }
                    }
                }
            }
        `;

        const req = createJwtRequest("secret", {});
        const result = await translateQuery(neoSchema, query, {
            req,
        });

        expect(formatCypher(result.cypher)).toMatchInlineSnapshot(`
            "MATCH (this:\`Movie\`)
            CALL {
                WITH this
                MATCH (this)<-[thisthis0:ACTED_IN]-(thisthis1:\`Actor\`)
                WHERE NOT ($thisparam0 IN thisthis1.favouriteColours)
                WITH collect({ screenTime: thisthis0.screenTime, node: { name: thisthis1.name, favouriteColours: thisthis1.favouriteColours } }) AS edges
                UNWIND edges AS edge
                WITH collect(edge) AS edges, size(collect(edge)) AS totalCount
                RETURN { edges: edges, totalCount: totalCount } AS actorsConnection
            }
            RETURN this { .title, actorsConnection } as this"
        `);

        expect(formatParams(result.params)).toMatchInlineSnapshot(`
            "{
                \\"thisparam0\\": \\"Blue\\"
            }"
        `);
    });
});
