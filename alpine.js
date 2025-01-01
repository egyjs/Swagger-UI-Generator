import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'
import monaco from 'monaco-alpinejs'
import $RefParser from "@apidevtools/json-schema-ref-parser";


Alpine.data('app', () => ({
    // Form data
    title: Alpine.$persist(''),
    description: Alpine.$persist(''),
    version: Alpine.$persist('1.0.0'),
    email: Alpine.$persist(null),
    urls: Alpine.$persist(['https://example.com']),
    paths: Alpine.$persist([
        {
            method: "post",
            url: '/',
            description: '',
            request: {
                body: JSON.stringify({"body":"request body Example"}, null, 2)
            },
            responses: [
                {
                    statusCode: '200',
                    description: 'Success',
                    content: 'json',
                    body: JSON.stringify({"body":"response body Example"}, null, 2)
                }
            ]
        }
    ]),
    toasts: {
        copy:{
            open: false,
            message: 'Copied!',
            timeout: 2000
        }
    },

    fireToast(toast){
        this.toasts[toast].open = true;
        setTimeout(() => {
            this.toasts[toast].open = false;
        }, this.toasts[toast].timeout);
    },

    uploadFile() {
        // confirm before overwriting
        if (!confirm('This will overwrite the current form data. Are you sure?')) {
            return;
        }
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    let json = JSON.parse(event.target.result);
                    // if json is swagger schema
                    if (!json.openapi) {
                        alert('Please indicate a valid OpenAPI schema');
                        return;
                    }
                    // clone the object to avoid modifying the original
                    let schema = JSON.parse(JSON.stringify(json));
                    await $RefParser.dereference(schema);
                    this.schema = schema;
                    this.generateFromSchema();
                } catch (error) {
                    console.error(error);
                    alert('Invalid JSON file');
                }
            };
            reader.readAsText(file);
        });
        fileInput.click();
    },

    // Swagger schema output
    schema: {},

    // Add a new URL to urls array
    addUrl() {
        this.urls.push('');
    },

    // Remove a URL by index
    removeUrl(index) {
        this.urls.splice(index, 1);
    },

    // Add a new path to paths array
    addPath() {
        this.paths.push({
            method: '',
            url: '',
            description: '',
            request: {
                body: ''
            },
            responses: []
        });
    },

    // Remove a path by index
    removePath(index) {
        this.paths.splice(index, 1);
    },

    // Add a response to a specific path
    addResponse(pathIndex) {
        this.paths[pathIndex].responses.push({
            statusCode: '200',
            description: 'Success',
            content: 'json',
            body: '{}'
        });
    },

    // Remove a response from a specific path
    removeResponse(pathIndex, responseIndex) {
        this.paths[pathIndex].responses.splice(responseIndex, 1);
    },

    getDefinition(body) {
        let d = convert(body);
        return {
            "type": "object",
            "properties": d
        }
    },
    // Generate Swagger schema live based on the form data
    generateSchema() {
        this.schema = {
            openapi: '3.0.1',
            info: {
                title: this.title,
                description: this.description,
                version: this.version,

            },
            servers: this.urls.map(url => ({ url })),
            paths: this.paths.reduce((acc, path) => {
                if (!acc[path.url]) {
                    acc[path.url] = {};
                }
                acc[path.url][path.method.toLowerCase()] = {
                    tags: [this.title],
                    summary: path.description,
                    operationId: `${this.title}-${path.method.toLowerCase()}-${path.url}`,
                    requestBody: (() => {
                        if (path.request) {
                            return {
                                content: {
                                    'application/json': {
                                        schema: {
                                            "$ref": "#/components/schemas/request"
                                        },
                                    },
                                },
                                required: true,
                            };
                        }
                        return null;
                    })(),
                    responses: path.responses.reduce((responseAcc, response) => {
                        const contentTypes = {};
                        let contentTypeData = {
                            schema: {
                                "$ref": `#/components/schemas/response${response.statusCode}`
                            },
                        }
                        if (['json', 'both'].includes(response.content)) {
                            contentTypes['application/json'] = contentTypeData;
                        }
                        if (['xml', 'both'].includes(response.content)) {
                            contentTypes['application/xml'] = contentTypeData;
                        }
                        responseAcc[response.statusCode] = {
                            description: response.description,
                            content: contentTypes,
                        };
                        return responseAcc;
                    }, {
                        '400': {
                            description: 'Bad Request',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                        '404': {
                            description: 'Not Found',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                        '500': {
                            description: 'Internal Server Error',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'string',
                                    },
                                },
                            },
                        }
                    }),
                };
                return acc;
            }, {}),
            components: {
                schemas: this.paths.reduce((acc, path) => {
                    if (path.request && path.request.body) {
                        acc[`request`] = this.getDefinition(path.request.body);
                    }
                    path.responses.forEach(response => {
                        acc[`response${response.statusCode}`] = this.getDefinition(response.body);
                    });
                    return acc;
                }, {}),
                responses: {},
                requestBodies: {},
                securitySchemes: {
                    BearerAuth: {
                        type: 'http',
                        scheme: 'bearer'
                    }
                }
            },
            security: [
                {
                    BearerAuth: []
                }
            ]
        };
        if (this.email) {
            this.schema.info.contact = {
                email: this.email,
            };
        }
    },
    generateFromSchema() {
        // {
        //   "openapi": "3.0.1",
        //   "info": {
        //     "title": "LabStatisticsEnquiry",
        //     "description": "",
        //     "version": "1.0.0"
        //   },
        //   "servers": [
        //     {
        //       "url": "https://internal-sit-api.nwc.com.sa/swanwc/lab/statistics/enquiry/v1"
        //     }
        //   ],
        //   "paths": {
        //     "/": {
        //       "post": {
        //         "tags": [
        //           "TankerStatisticsEnquiry"
        //         ],
        //         "summary": "",
        //         "operationId": "LabStatisticsEnquiry",
        //         "requestBody": {
        //           "content": {
        //             "application/json": {
        //               "schema": {
        //                 "$ref": "#/components/schemas/request"
        //               }
        //             }
        //           },
        //           "required": true
        //         },
        //         "responses": {
        //           "200": {
        //             "description": "Success",
        //             "content": {
        //               "application/json": {
        //                 "schema": {
        //                   "$ref": "#/components/schemas/response200"
        //                 }
        //               }
        //             }
        //           },
        //           "400": {
        //             "description": "error",
        //             "content": {
        //               "application/json": {
        //                 "schema": {
        //                   "$ref": "#/components/schemas/response400"
        //                 }
        //               }
        //             }
        //           },
        //           "401": {
        //             "description": "error",
        //             "content": {
        //               "application/json": {
        //                 "schema": {
        //                   "$ref": "#/components/schemas/response401"
        //                 }
        //               }
        //             }
        //           },
        //           "404": {
        //             "description": "Not Found",
        //             "content": {
        //               "application/json": {
        //                 "schema": {
        //                   "$ref": "#/components/schemas/response404"
        //                 }
        //               }
        //             }
        //           },
        //           "405": {
        //             "description": "Not Found",
        //             "content": {
        //               "application/json": {
        //                 "schema": {
        //                   "$ref": "#/components/schemas/response405"
        //                 }
        //               }
        //             }
        //           },
        //           "415": {
        //             "description": "Not Found",
        //             "content": {
        //               "application/json": {
        //                 "schema": {
        //                   "$ref": "#/components/schemas/response415"
        //                 }
        //               }
        //             }
        //           },
        //           "500": {
        //             "description": "Internal Service Error.",
        //             "content": {
        //               "application/json": {
        //                 "schema": {
        //                   "$ref": "#/components/schemas/response500"
        //                 }
        //               }
        //             }
        //           },
        //           "503": {
        //             "description": "Service Unavailable",
        //             "content": {
        //               "application/json": {
        //                 "schema": {
        //                   "$ref": "#/components/schemas/response503"
        //                 }
        //               }
        //             }
        //           }
        //         }
        //       }
        //     }
        //   },
        //   "components": {
        //     "schemas": {
        //       "request": {
        //         "type": "object",
        //         "required": [
        //           "transactionId",
        //           "sourceApplication",
        //           "statisticsStartDate",
        //           "statisticsEndDate",
        //           "directorate"
        //         ],
        //         "additionalProperties": false,
        //         "properties": {
        //           "transactionId": {
        //             "type": "string",
        //             "example": "12345"
        //           },
        //           "sourceApplication": {
        //             "type": "string",
        //             "example": "SWA",
        //             "enum": [
        //               "SWA"
        //             ]
        //           },
        //           "statisticsStartDate": {
        //             "type": "string",
        //             "pattern": "^(0[1-9]|[12][0-9]|3[01])\\/(0[1-9]|1[0-2])\\/\\d{4} \\d{2}:\\d{2}:\\d{2}$",
        //             "example": "12/12/2024 14:30:00"
        //           },
        //           "statisticsEndDate": {
        //             "type": "string",
        //             "pattern": "^(0[1-9]|[12][0-9]|3[01])\\/(0[1-9]|1[0-2])\\/\\d{4} \\d{2}:\\d{2}:\\d{2}$",
        //             "example": "15/04/2023 14:30:00"
        //           },
        //           "directorate": {
        //             "type": "string",
        //             "example": "RCBU",
        //             "enum": [
        //               "ALL",
        //               "RCBU",
        //               "AS",
        //               "TCBU",
        //               "MCBU",
        //               "BA",
        //               "NJ",
        //               "JZBU",
        //               "HA",
        //               "MK",
        //               "MD",
        //               "HS",
        //               "QS",
        //               "RI",
        //               "JF",
        //               "TB",
        //               "JCBU",
        //               "SH"
        //             ]
        //           }
        //         }
        //       },
        //       "response200": {
        //         "type": "object",
        //         "properties": {
        //           "transactionId": {
        //             "type": "string",
        //             "example": "12345"
        //           },
        //           "sourceApplication": {
        //             "type": "string",
        //             "example": "TMS"
        //           },
        //           "isSuccess": {
        //             "type": "boolean"
        //           },
        //           "message": {
        //             "type": "string",
        //             "example": "Request processed successfully"
        //           },
        //           "data": {
        //             "type": "object",
        //             "properties": {
        //               "pendingOrders12Hours": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "pendingOrders72Hours": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "ordersZonesLinkedToNetwork": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "ordersZonesNotLinkedToNetwork": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "totalOrders": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "totalCancelledOrdersByCustomer": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "totalCancelledOrdersBySystemAgent": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "totalCancelledOrders": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "deliveredOrdersWithin12Hours": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "deliveredOrdersMore12Hours": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "avgDeliveryTime": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "deliveredOrders": {
        //                 "type": "number",
        //                 "example": 0
        //               },
        //               "comment": {
        //                 "type": "string",
        //                 "example": "Requested at 2024-12-23 17:08:31 for RCBU from date 2024-12-12 14:30:00 to date 2024-12-12 14:30:00"
        //               }
        //             }
        //           }
        //         }
        //       },
        //       "response400": {
        //         "type": "object",
        //         "properties": {
        //           "isSuccess": {
        //             "type": "boolean",
        //             "example": false
        //           },
        //           "message": {
        //             "type": "string",
        //             "example": "Invalid request parameters"
        //           },
        //           "error": {
        //             "type": "array",
        //             "items": {
        //               "type": "object",
        //               "properties": {
        //                 "code": {
        //                   "type": "number",
        //                   "example": 10001002
        //                 },
        //                 "description": {
        //                   "type": "string",
        //                   "example": "Error processing the request"
        //                 },
        //                 "category": {
        //                   "type": "string",
        //                   "example": "Validation"
        //                 },
        //                 "level": {
        //                   "type": "string",
        //                   "example": "ERROR"
        //                 }
        //               }
        //             }
        //           }
        //         }
        //       },
        //       "response401": {
        //         "type": "object",
        //         "properties": {
        //           "isSuccess": {
        //             "type": "boolean",
        //             "example": false
        //           },
        //           "message": {
        //             "type": "string",
        //             "example": "Authentication failed"
        //           },
        //           "error": {
        //             "type": "array",
        //             "items": {
        //               "type": "object",
        //               "properties": {
        //                 "code": {
        //                   "type": "number",
        //                   "example": 10002001
        //                 },
        //                 "description": {
        //                   "type": "string",
        //                   "example": "Authentication failed"
        //                 },
        //                 "category": {
        //                   "type": "string",
        //                   "example": "Authentication"
        //                 },
        //                 "level": {
        //                   "type": "string",
        //                   "example": "ERROR"
        //                 }
        //               }
        //             }
        //           }
        //         }
        //       },
        //       "response404": {
        //         "type": "object",
        //         "properties": {
        //           "isSuccess": {
        //             "type": "boolean",
        //             "example": false
        //           },
        //           "message": {
        //             "type": "string",
        //             "example": "Not Found"
        //           },
        //           "error": {
        //             "type": "array",
        //             "items": {
        //               "type": "object",
        //               "properties": {
        //                 "code": {
        //                   "type": "number",
        //                   "example": 10004000
        //                 },
        //                 "description": {
        //                   "type": "string",
        //                   "example": "Not Found"
        //                 },
        //                 "category": {
        //                   "type": "string",
        //                   "example": "Resource Not Found"
        //                 },
        //                 "level": {
        //                   "type": "string",
        //                   "example": "WARN"
        //                 }
        //               }
        //             }
        //           }
        //         }
        //       },
        //       "response405": {
        //         "type": "object",
        //         "properties": {
        //           "isSuccess": {
        //             "type": "boolean",
        //             "example": false
        //           },
        //           "message": {
        //             "type": "string",
        //             "example": "API method not found"
        //           },
        //           "error": {
        //             "type": "array",
        //             "items": {
        //               "type": "object",
        //               "properties": {
        //                 "code": {
        //                   "type": "number",
        //                   "example": 10004001
        //                 },
        //                 "description": {
        //                   "type": "string",
        //                   "example": "Method Not Allowed"
        //                 },
        //                 "category": {
        //                   "type": "string",
        //                   "example": "Resource Not Found"
        //                 },
        //                 "level": {
        //                   "type": "string",
        //                   "example": "WARN"
        //                 }
        //               }
        //             }
        //           }
        //         }
        //       },
        //       "response415": {
        //         "type": "object",
        //         "properties": {
        //           "isSuccess": {
        //             "type": "boolean",
        //             "example": false
        //           },
        //           "message": {
        //             "type": "string",
        //             "example": "Unsupported API metadata"
        //           },
        //           "error": {
        //             "type": "array",
        //             "items": {
        //               "type": "object",
        //               "properties": {
        //                 "code": {
        //                   "type": "number",
        //                   "example": 10004002
        //                 },
        //                 "description": {
        //                   "type": "string",
        //                   "example": "Unsupported Media Type"
        //                 },
        //                 "category": {
        //                   "type": "string",
        //                   "example": "Validation"
        //                 },
        //                 "level": {
        //                   "type": "string",
        //                   "example": "ERROR"
        //                 }
        //               }
        //             }
        //           }
        //         }
        //       },
        //       "response500": {
        //         "type": "object",
        //         "properties": {
        //           "isSuccess": {
        //             "type": "boolean",
        //             "example": false
        //           },
        //           "message": {
        //             "type": "string",
        //             "example": "Internal Service Error."
        //           },
        //           "error": {
        //             "type": "array",
        //             "items": {
        //               "type": "object",
        //               "properties": {
        //                 "code": {
        //                   "type": "number",
        //                   "example": 10005001
        //                 },
        //                 "description": {
        //                   "type": "string",
        //                   "example": "Internal Service Error."
        //                 },
        //                 "category": {
        //                   "type": "string",
        //                   "example": "System"
        //                 },
        //                 "level": {
        //                   "type": "string",
        //                   "example": "CRITICAL"
        //                 }
        //               }
        //             }
        //           }
        //         }
        //       },
        //       "response503": {
        //         "type": "object",
        //         "properties": {
        //           "isSuccess": {
        //             "type": "boolean",
        //             "example": false
        //           },
        //           "message": {
        //             "type": "string",
        //             "example": "Service Unavailable"
        //           },
        //           "error": {
        //             "type": "array",
        //             "items": {
        //               "type": "object",
        //               "properties": {
        //                 "code": {
        //                   "type": "number",
        //                   "example": 12005002
        //                 },
        //                 "description": {
        //                   "type": "string",
        //                   "example": "Service Unavailable"
        //                 },
        //                 "category": {
        //                   "type": "string",
        //                   "example": "System"
        //                 },
        //                 "level": {
        //                   "type": "string",
        //                   "example": "CRITICAL"
        //                 }
        //               }
        //             }
        //           }
        //         }
        //       }
        //     },
        //     "responses": {},
        //     "requestBodies": {},
        //     "securitySchemes": {
        //       "BearerAuth": {
        //         "type": "http",
        //         "scheme": "bearer"
        //       }
        //     }
        //   },
        //   "security": [
        //     {
        //       "BearerAuth": []
        //     }
        //   ]
        // }
        this.title = this.schema.info.title;
        this.description = this.schema.info.description;
        this.version = this.schema.info.version;
        this.email = this.schema.info?.contact?.email || null;
        this.urls = this.schema.servers.map(server => server.url);
        this.paths = Object.entries(this.schema.paths).map(([url, methods]) => {
            return Object.entries(methods).map(([method, data]) => {
                return {
                    method: method.toUpperCase(),
                    url,
                    description: data.summary,
                    request: (() => {
                        if (data.requestBody) {
                            return {
                                body: JSON.stringify(
                                    this.getExample(data.requestBody.content['application/json'].schema),
                                    null, 2)
                            };
                        }
                        return null;
                    })(),
                    responses: Object.entries(data.responses).map(([statusCode, response]) => {
                        return {
                            statusCode,
                            description: response.description,
                            content: (() => {
                                if (response.content['application/json']) {
                                    return 'json';
                                }
                                if (response.content['application/xml']) {
                                    return 'xml';
                                }
                                return 'both';
                            })(),
                            body: JSON.stringify(
                                this.getExample(response.content['application/json'].schema),
                                null, 2),

                        };
                    }),
                };
            });
        }).flat();
    },
    copySchema() {
        navigator.clipboard.writeText(JSON.stringify(this.schema, null, 2));
        // change button to "Copied!"
        const button = document.querySelector('.submit');
        this.fireToast('copy');
    },
    downloadSchema() {
        const blob = new Blob([JSON.stringify(this.schema, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.title} Swagger.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
    // Watch the form data and generate schema live
    init() {
        this.$watch('title', () => this.generateSchema());
        this.$watch('description', () => this.generateSchema());
        this.$watch('version', () => this.generateSchema());
        this.$watch('email', () => this.generateSchema());
        this.$watch('urls', () => this.generateSchema());
        this.$watch('paths', () => this.generateSchema(), { deep: true });
        this.generateSchema();


    },
    getExample(schema) {
        if (schema.example !== undefined) {
            return schema.example;
        }
        if (schema.type === 'boolean'){
            return true;
        }
        if (schema.properties) { // object
            return Object.entries(schema.properties).reduce((acc, [key, value]) => {
                acc[key] = this.getExample(value);
                return acc;
            }, {});
        }
        if (schema.items) { // array
            return [this.getExample(schema.items)];
        }
        console.log(schema)
        return '';
    }
}));


Alpine.plugin(persist)
Alpine.plugin(monaco)
window.Alpine = Alpine;
Alpine.start();
