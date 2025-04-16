var archives = {
  "distinct": true,
  "variables": [
    {
      "termType": "Variable",
      "value": "archive_1"
    },
    {
      "termType": "Variable",
      "value": "map_2"
    }
  ],
  "order": null,
  "branches": [
    {
      "line": {
        "s": "archive_1",
        "p": "https://g17.dhi-roma.it/shacl/sparnatural-config/wkt",
        "o": "map_2",
        "sType": "https://g17.dhi-roma.it/shacl/sparnatural-config/archive",
        "oType": "https://g17.dhi-roma.it/shacl/sparnatural-config/map",
        "values": []
      },
      "children": []
    }
  ]
}

var regions = {
  "distinct": true,
  "variables": [
    {
      "expression": {
        "type": "aggregate",
        "aggregation": "count",
        "distinct": false,
        "expression": {
          "termType": "Variable",
          "value": "institution_1"
        }
      },
      "variable": {
        "termType": "Variable",
        "value": "institution_1_count"
      }
    },
    {
      "termType": "Variable",
      "value": "region_4"
    }
  ],
  "order": null,
  "branches": [
    {
      "line": {
        "s": "institution_1",
        "p": "https://g17.dhi-roma.it/shacl/sparnatural-config/primary_place",
        "o": "place_2",
        "sType": "https://g17.dhi-roma.it/shacl/sparnatural-config/institution",
        "oType": "https://g17.dhi-roma.it/shacl/sparnatural-config/place",
        "values": []
      },
      "children": [
        {
          "line": {
            "s": "place_2",
            "p": "https://g17.dhi-roma.it/shacl/sparnatural-config/falls_within",
            "o": "region_4",
            "sType": "https://g17.dhi-roma.it/shacl/sparnatural-config/place",
            "oType": "https://g17.dhi-roma.it/shacl/sparnatural-config/region",
            "values": []
          },
          "children": []
        }
      ]
    }
  ]
}

var benefices = {
  "distinct": true,
  "variables": [
    {
      "expression": {
        "type": "aggregate",
        "aggregation": "count",
        "distinct": false,
        "expression": {
          "termType": "Variable",
          "value": "benefice_1"
        }
      },
      "variable": {
        "termType": "Variable",
        "value": "benefice_1_count"
      }
    },
    {
      "termType": "Variable",
      "value": "region_6"
    }
  ],
  "order": null,
  "branches": [
    {
      "line": {
        "s": "benefice_1",
        "p": "https://g17.dhi-roma.it/shacl/sparnatural-config/in_diocese",
        "o": "institution_2",
        "sType": "https://g17.dhi-roma.it/shacl/sparnatural-config/benefice",
        "oType": "https://g17.dhi-roma.it/shacl/sparnatural-config/institution",
        "values": []
      },
      "children": [
        {
          "line": {
            "s": "institution_2",
            "p": "https://g17.dhi-roma.it/shacl/sparnatural-config/primary_place",
            "o": "place_4",
            "sType": "https://g17.dhi-roma.it/shacl/sparnatural-config/institution",
            "oType": "https://g17.dhi-roma.it/shacl/sparnatural-config/place",
            "values": []
          },
          "children": [
            {
              "line": {
                "s": "place_4",
                "p": "https://g17.dhi-roma.it/shacl/sparnatural-config/falls_within",
                "o": "region_6",
                "sType": "https://g17.dhi-roma.it/shacl/sparnatural-config/place",
                "oType": "https://g17.dhi-roma.it/shacl/sparnatural-config/region",
                "values": []
              },
              "children": []
            }
          ]
        }
      ]
    }
  ]
}