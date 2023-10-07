import { Formatter, CommentPolicy, FracturedJsonOptions, EolStyle } from "scripts/fracturedjson/index"

export class FracturedJson {
  static options: FracturedJsonOptions
  static formatter: Formatter

  static InitializeFracturedJson() {
    // For examples of the options, see
    // https://github.com/j-brooke/FracturedJson/wiki/Options
    FracturedJson.options = new FracturedJsonOptions()
    FracturedJson.options.MaxTotalLineLength = 140
    // FracturedJson.options.MaxInlineLength = 120
    FracturedJson.options.MaxInlineComplexity = 5
    FracturedJson.options.MaxCompactArrayComplexity = 5
    FracturedJson.options.MaxTableRowComplexity = 5
    // FracturedJson.options.MinCompactArrayRowItems = 6
    // FracturedJson.options.DontJustifyNumbers = true
    FracturedJson.options.IndentSpaces = 2
    FracturedJson.options.JsonEolStyle = EolStyle.Crlf

    FracturedJson.formatter = new Formatter()
    FracturedJson.formatter.Options = FracturedJson.options
  }
}


