var request = require("request");

function bfInterpreter(bot, sender, args, data, client)
{
    if(args[0] == "pastebin")
    {
        var id = args[1];
        request("http://pastebin.com/raw.php?i=" + id, function(err, res, code)
        {
            if(err)
            {
                bot.sendClient("@" + sender + " " + err.toString(), client);
                return;
            }

            var result = bfRun(code);
            bot.sendAll("@" + sender + " " + result.output, client);
        });
    }
    else if(args[0] == "debug")
    {
        var code = args.slice(1).join(" ");
        var result = bfRun(code);

        if(typeof result.error != 'undefined')
            bot.sendClient("@" + sender + " " + createErrorMessage(result.output, code, result.error),client);
        else
            bot.sendClient("@" + sender + " " + result.output + "\nVariables: " + JSON.stringify(result.variables),client);
    }
    else
    {
        var code = args.join(" ");
        var result = bfRun(code);

        if(typeof result.error != 'undefined')
            bot.sendClient("@" + sender + " " + createErrorMessage(result.output, code, result.error), client);
        else
            bot.sendAll("@" + sender + " " + result.output, client);
    }
}

function createErrorMessage(message, code, index)
{
    return message + "\n" + code.substr(index - 3, 7) + " char " + index + "\n   ^   ";

}

function bfRun(code)
{
    var out = "Output: ";
    var loops = [];
    var loopCount = {};
    var vars = [];
    var index = 0;

    for(var i = 0; i < code.length; i++)
    {
        var char = code[i];
        vars[index] = vars[index] || 0;

        if(char == "+")
        {
            vars[index]++;
            if(vars[index] > 255)
            {
                vars[index] = 0;
            }
        }
        else if(char == "-")
        {
            vars[index]--;
            if(vars[index] < 0)
            {
                vars[index] = 255;
            }
        }
        else if(char == ">")
        {
            index++;
        }
        else if(char == "<")
        {
            index--;
        }
        else if(char == ".")
        {
            out += String.fromCharCode(vars[index]);
        }
        else if(char == ",")
        {
            var message = "Error: , (read) not supported";
            return {output: message, variables: vars, index: index, error: i};
        }
        else if(char == "[")
        {
            loops.unshift(i);
        }
        else if(char == "]")
        {
            if(vars[index] == 0)
            {
                loops.splice(0, 1);
            }
            else
            {
                i = loops[0];

                var countKey = i.toString();

                loopCount[countKey] = loopCount[countKey] + 1 || 1;
                if(loopCount[countKey] > 42666)
                {
                    var message = "Error: maximum 42666 loops allowed";
                    return {output: message, variables: vars, index: index, error: i};
                }
            }
        }
    }

    return {output: out, variables: vars, index: index};
}

var a = {
    action: bfInterpreter,
    man: "Syntax is !bf or !brainfuck <brainfuck code>. Executes the code and produces and output."
}
module.exports = {
    
};
